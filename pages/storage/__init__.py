"""Database side of the pages' storage.

The pages keep their data as JSON text under keys such as "bioreg.reports". Each module here knows
one key: how to build that text from the models (read) and how to save the text into the models
(write). pages/views.py calls these two functions (data_read and data_write).
"""

from django.core.exceptions import PermissionDenied

from . import (
    activity,
    collectors,
    drafts,
    inventory,
    mapdata,
    mdas,
    notifications,
    reports,
    settings,
    users,
)

DATASETS = {}
for module in (
    mapdata,
    reports,
    users,
    mdas,
    collectors,
    inventory,
    notifications,
    activity,
    settings,
):
    DATASETS.update(module.DATASETS)


def read_all(user):
    """Every data set as {key: JSON text or None} for the signed-in user."""
    values = {key: read(user) for key, (read, _write) in DATASETS.items()}
    values[drafts.key_for(user)] = drafts.read(user)
    return values


def write_one(user, key, text):
    """Save one data set. Raises PermissionDenied when this user may not change it, KeyError for unknown keys."""
    if key.startswith(drafts.PREFIX):
        drafts.check_key(user, key)
        return drafts.write(user, text)
    if key not in DATASETS:
        raise KeyError(key)
    _read, write = DATASETS[key]
    return write(user, text)


def is_synced_key(key):
    return key in DATASETS or key.startswith(drafts.PREFIX)


__all__ = ["DATASETS", "PermissionDenied", "is_synced_key", "read_all", "write_one"]
