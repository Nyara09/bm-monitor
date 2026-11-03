from django.contrib.auth.models import User
from django.urls import reverse

from accounts.models import PagePermission
from accounts.permissions import has_permission
from core.testing import ScreenTestCase

NEW_USER = {
    "username": "achol",
    "first_name": "Achol",
    "phone": "0911",
    "role": "reader",
    "status": "Active",
    "password": "Str0ng-pass-word!",
    "can_open_map_overview_card": "on",
}


class SignInTests(ScreenTestCase):
    def test_sign_in_goes_to_first_allowed_page(self):
        response = self.client.post(
            reverse("accounts:sign_in"), {"username": "admin_user", "password": "pass-12345-word"}
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/screens/dashboard/")

    def test_wrong_password(self):
        response = self.client.post(
            reverse("accounts:sign_in"), {"username": "admin_user", "password": "no"}
        )
        self.assertContains(response, "correct")

    def test_sign_out(self):
        self.sign_in(self.admin)
        self.client.post(reverse("accounts:sign_out"))
        self.assertEqual(self.client.get(reverse("registry:mda_list")).status_code, 302)


class UserScreenTests(ScreenTestCase):
    def test_admin_adds_user_who_can_sign_in(self):
        self.sign_in(self.admin)
        response = self.client.post(reverse("accounts:user_create"), NEW_USER)
        self.assertEqual(response.status_code, 302)
        person = User.objects.get(username="achol")
        self.assertEqual(person.profile.role, "reader")
        self.assertTrue(self.client.login(username="achol", password="Str0ng-pass-word!"))

    def test_password_is_required_for_new_user(self):
        self.sign_in(self.admin)
        response = self.client.post(reverse("accounts:user_create"), {**NEW_USER, "password": ""})
        self.assertContains(response, "Enter a password")

    def test_custom_permissions_replace_role_defaults(self):
        self.sign_in(self.admin)
        self.client.post(
            reverse("accounts:user_create"),
            {
                **NEW_USER,
                "custom_permissions": "on",
                "perm_mdam_view": "on",
                "perm_mdam_edit": "on",
            },
        )
        person = User.objects.get(username="achol")
        self.assertEqual(PagePermission.objects.filter(profile=person.profile).count(), 23)
        self.assertTrue(has_permission(person, "mdam", "edit"))
        self.assertFalse(has_permission(person, "dash", "view"))

    def test_edit_keeps_password_when_empty(self):
        self.sign_in(self.admin)
        self.client.post(reverse("accounts:user_create"), NEW_USER)
        person = User.objects.get(username="achol")
        self.client.post(
            reverse("accounts:user_edit", args=[person.pk]),
            {**NEW_USER, "password": "", "phone": "0999"},
        )
        person.refresh_from_db()
        self.assertEqual(person.profile.phone, "0999")
        self.assertTrue(person.check_password("Str0ng-pass-word!"))

    def test_cannot_delete_yourself(self):
        self.sign_in(self.admin)
        self.client.post(reverse("accounts:user_delete", args=[self.admin.pk]))
        self.assertTrue(User.objects.filter(pk=self.admin.pk).exists())

    def test_sub_admin_cannot_open_users(self):
        from accounts.models import Role

        sub = self.make_user("sub_user", Role.SUBADMIN)
        self.sign_in(sub)
        self.assertEqual(self.client.get(reverse("accounts:user_list")).status_code, 403)
