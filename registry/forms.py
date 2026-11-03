"""Forms of the registry app: MDAs, data collectors, registration sites and site targets."""

from django import forms

from core.forms import BootstrapFormMixin
from geography.models import County

from .models import DataCollector, Mda, RegistrationSite, SiteDataCollector


class CountyChoiceField(forms.ModelChoiceField):
    """Shows 'State – County' so same-named counties can be told apart."""

    def label_from_instance(self, county):
        return f"{county.state.name} – {county.name}"


class MdaForm(BootstrapFormMixin, forms.ModelForm):
    class Meta:
        model = Mda
        fields = ["name"]


class DataCollectorForm(BootstrapFormMixin, forms.ModelForm):
    class Meta:
        model = DataCollector
        fields = ["name", "phone", "status"]


class RegistrationSiteForm(BootstrapFormMixin, forms.ModelForm):
    county = CountyChoiceField(queryset=County.objects.select_related("state"), required=False)

    class Meta:
        model = RegistrationSite
        fields = [
            "name",
            "state",
            "county",
            "mda",
            "status",
            "capacity",
            "longitude",
            "latitude",
            "note",
        ]
        widgets = {"note": forms.Textarea(attrs={"rows": 3})}


class SiteTargetForm(BootstrapFormMixin, forms.ModelForm):
    """The target of a site: how many to register, when, who supervises, which collectors."""

    site = forms.ModelChoiceField(
        queryset=RegistrationSite.objects.all(), label="Registration site"
    )
    collectors = forms.ModelMultipleChoiceField(
        queryset=DataCollector.objects.all(), required=False, label="Data collectors"
    )

    class Meta:
        model = RegistrationSite
        fields = [
            "target_total",
            "opening_date",
            "closing_date",
            "supervisor_name",
            "dcas_planned",
            "comment",
        ]
        widgets = {
            "opening_date": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
            "closing_date": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
        }

    field_order = [
        "site",
        "target_total",
        "opening_date",
        "closing_date",
        "supervisor_name",
        "dcas_planned",
        "collectors",
        "comment",
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:  # editing: the site is fixed
            self.fields["site"].initial = self.instance
            self.fields["site"].disabled = True
            self.fields["collectors"].initial = self.instance.data_collectors.all()

    def clean(self):
        cleaned = super().clean()
        opening, closing = cleaned.get("opening_date"), cleaned.get("closing_date")
        if opening and closing and closing < opening:
            self.add_error("closing_date", "The closing date is before the opening date.")
        return cleaned

    def save(self, commit=True):
        """Save the target fields on the chosen site and set its collectors."""
        site = self.cleaned_data["site"]
        for name in self.Meta.fields:
            setattr(site, name, self.cleaned_data[name])
        site.is_target = True
        site.save()
        chosen = set(self.cleaned_data["collectors"])
        site.sitedatacollector_set.exclude(collector__in=chosen).delete()
        for collector in chosen:
            SiteDataCollector.objects.get_or_create(site=site, collector=collector)
        return site
