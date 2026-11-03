from django.db import migrations, models

OLD_NAMES = ["BioReg Monitor", "BioReg Admin"]
NEW_NAME = "BM Monitor"


def rename_default_company(apps, schema_editor):
    """Rows that still carry the old default name get the new system name."""
    CompanySetting = apps.get_model("core", "CompanySetting")
    CompanySetting.objects.filter(company_name__in=OLD_NAMES).update(company_name=NEW_NAME)


class Migration(migrations.Migration):
    dependencies = [("core", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="companysetting",
            name="company_name",
            field=models.CharField(default=NEW_NAME, max_length=150),
        ),
        migrations.RunPython(rename_default_company, migrations.RunPython.noop),
    ]
