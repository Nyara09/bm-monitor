"""bioreg.reports: the daily registration reports."""

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.db import transaction

from registry.models import Mda, RegistrationSite
from reports.models import (
    DailyReport,
    ReportDcaEntry,
    ReportMdaEntry,
    ReportReviewEntry,
    ReportStatus,
)

from .access import is_manager
from .common import from_json, iso_moment, parse_day, parse_moment, split_extra, to_int, to_json

User = get_user_model()

MAPPED_KEYS = {
    "id", "site", "date", "type", "by", "sup", "at", "dcas", "mdas", "items", "setups",
    "regMda", "note", "rs", "rvBy", "rvAt", "rvWhy", "late", "log",
}  # fmt: skip


def report_record(report):
    """One DailyReport as the dictionary the pages keep."""
    record = {
        "id": report.client_id,
        "site": report.site_code,
        "date": report.report_date.isoformat(),
        "type": report.report_type,
        "by": report.submitted_by_username,
        "at": iso_moment(report.submitted_at),
        "regMda": report.registration_mda,
        "note": report.note,
        "items": report.items,
        "setups": report.setups,
        "sup": report.supervisor_name,
        "late": report.late_reason,
        "rs": report.status,
        "rvBy": report.reviewed_by_name,
        "rvAt": iso_moment(report.reviewed_at),
        "rvWhy": report.review_reason,
        "dcas": [
            {"name": line.collector_name, "n": line.registered} for line in report.dca_entries.all()
        ],
        "mdas": [
            {
                "mda": line.mda.name,
                "n": line.registered,
                "ok": line.succeeded,
                "pend": line.pending,
                "fail": line.failed,
            }
            for line in report.mda_entries.all()
        ],
        "log": [
            {"t": iso_moment(entry.at), "by": entry.by, "a": entry.action, "why": entry.reason}
            for entry in report.review_log.all()
        ],
    }
    record.update(report.extra)
    return record


def read(user):
    reports = DailyReport.objects.select_related("site").prefetch_related(
        "dca_entries", "mda_entries__mda", "review_log"
    )
    return to_json([report_record(report) for report in reports.order_by("id")])


def find_user(name):
    """Match a name written on a report to a Django user (username first, then full name)."""
    if not name:
        return None
    return (
        User.objects.filter(username__iexact=name).first()
        or User.objects.filter(first_name__iexact=name).first()
    )


def apply_record(report, record, sites):
    """Copy a page record onto a DailyReport row (saves it, then replaces its lines)."""
    code = str(record.get("site", ""))
    report.site_code = code
    report.site = sites.get(code)
    report.report_date = (
        parse_day(record.get("date")) or report.report_date or parse_day("1970-01-01")
    )
    report.report_type = "multi" if record.get("type") == "multi" else "single"
    report.submitted_by_username = str(record.get("by", ""))
    report.submitted_by = find_user(report.submitted_by_username)
    report.submitted_at = parse_moment(record.get("at"))
    report.registration_mda = str(record.get("regMda", ""))
    report.note = str(record.get("note", ""))
    report.items = record.get("items") or []
    report.setups = record.get("setups") or []
    report.supervisor_name = str(record.get("sup", ""))
    report.supervisor = find_user(report.supervisor_name)
    report.late_reason = str(record.get("late", ""))
    status = record.get("rs") or ReportStatus.PENDING
    report.status = status if status in ReportStatus.values else ReportStatus.PENDING
    report.reviewed_by_name = str(record.get("rvBy", ""))
    report.reviewed_by = find_user(report.reviewed_by_name)
    report.reviewed_at = parse_moment(record.get("rvAt"))
    report.review_reason = str(record.get("rvWhy", ""))
    report.extra = split_extra(record, MAPPED_KEYS)
    report.save()

    report.dca_entries.all().delete()
    ReportDcaEntry.objects.bulk_create(
        ReportDcaEntry(
            report=report,
            collector_name=str(line.get("name", "")),
            registered=to_int(line.get("n")),
        )
        for line in record.get("dcas") or []
    )
    report.mda_entries.all().delete()
    for line in record.get("mdas") or []:
        name = str(line.get("mda", "")).strip()
        if not name:
            continue
        mda, _ = Mda.objects.get_or_create(name=name)
        ReportMdaEntry.objects.create(
            report=report,
            mda=mda,
            registered=to_int(line.get("n")),
            succeeded=to_int(line.get("ok")),
            pending=to_int(line.get("pend")),
            failed=to_int(line.get("fail")),
        )
    report.review_log.all().delete()
    ReportReviewEntry.objects.bulk_create(
        ReportReviewEntry(
            report=report,
            at=parse_moment(entry.get("t")) or report.created_at,
            by=str(entry.get("by", "")),
            action=str(entry.get("a", "")),
            reason=str(entry.get("why", "")),
        )
        for entry in record.get("log") or []
    )


def allowed_for_member(user, existing, record):
    """Rules for people who are not admins: own reports only, nothing accepted, always Pending."""
    username = user.get_username().lower()
    if str(record.get("by", "")).lower() != username:
        return False
    if existing is not None and existing.status == ReportStatus.ACCEPTED:
        return False
    return True


@transaction.atomic
def write(user, text):
    records = from_json(text, [])
    if not isinstance(records, list):
        raise PermissionDenied("Reports must be a list")
    manager = is_manager(user)
    existing = {
        report.client_id: report
        for report in DailyReport.objects.prefetch_related(
            "dca_entries", "mda_entries__mda", "review_log"
        )
    }
    sites = {site.code: site for site in RegistrationSite.objects.all()}
    sent_ids = set()

    for record in records:
        client_id = str(record.get("id", ""))
        if not client_id:
            continue
        sent_ids.add(client_id)
        report = existing.get(client_id)
        if report is not None and report_record(report) == normalise(record):
            continue
        if not manager:
            if not allowed_for_member(user, report, record):
                continue
            record = dict(record)
            record.update({"rs": ReportStatus.PENDING, "rvBy": "", "rvAt": "", "rvWhy": ""})
        if report is None:
            report = DailyReport(client_id=client_id)
        apply_record(report, record, sites)

    for client_id, report in existing.items():
        if client_id in sent_ids:
            continue
        own = report.submitted_by_username.lower() == user.get_username().lower()
        if manager or (own and report.status != ReportStatus.ACCEPTED):
            report.delete()


def normalise(record):
    """The record as it would come back from the database (so unchanged ones can be skipped)."""
    return {
        **{key: value for key, value in record.items() if key not in MAPPED_KEYS},
        "id": str(record.get("id", "")),
        "site": str(record.get("site", "")),
        "date": str(record.get("date", ""))[:10],
        "type": "multi" if record.get("type") == "multi" else "single",
        "by": str(record.get("by", "")),
        "at": iso_moment(parse_moment(record.get("at"))),
        "regMda": str(record.get("regMda", "")),
        "note": str(record.get("note", "")),
        "items": record.get("items") or [],
        "setups": record.get("setups") or [],
        "sup": str(record.get("sup", "")),
        "late": str(record.get("late", "")),
        "rs": record.get("rs") if record.get("rs") in ReportStatus.values else ReportStatus.PENDING,
        "rvBy": str(record.get("rvBy", "")),
        "rvAt": iso_moment(parse_moment(record.get("rvAt"))),
        "rvWhy": str(record.get("rvWhy", "")),
        "dcas": [
            {"name": str(x.get("name", "")), "n": to_int(x.get("n"))}
            for x in record.get("dcas") or []
        ],
        "mdas": [
            {
                "mda": str(x.get("mda", "")).strip(),
                "n": to_int(x.get("n")),
                "ok": to_int(x.get("ok")),
                "pend": to_int(x.get("pend")),
                "fail": to_int(x.get("fail")),
            }
            for x in record.get("mdas") or []
            if str(x.get("mda", "")).strip()
        ],
        "log": [
            {
                "t": iso_moment(parse_moment(x.get("t"))),
                "by": str(x.get("by", "")),
                "a": str(x.get("a", "")),
                "why": str(x.get("why", "")),
            }
            for x in record.get("log") or []
        ],
    }


DATASETS = {"bioreg.reports": (read, write)}
