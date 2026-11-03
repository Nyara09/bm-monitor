import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from accounts.models import PagePermission, UserProfile
from core.models import ActivityLog

User = get_user_model()


class SignInTests(TestCase):
    def post_sign_in(self, username, password):
        return self.client.post(
            reverse("pages:sign_in"),
            data=json.dumps({"username": username, "password": password}),
            content_type="application/json",
        )

    def test_superuser_gets_admin_profile_and_all_cards(self):
        User.objects.create_superuser("boss", password="long-password-1")
        response = self.post_sign_in("boss", "long-password-1")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["role"], "admin")
        self.assertEqual(data["cards"], {"adm": 1, "nat": 1, "sup": 1})
        self.assertNotIn("perms", data)

    def test_user_created_without_profile_becomes_supervisor(self):
        User.objects.create_user(
            "amit", password="long-password-1", first_name="Amit", last_name="Deng"
        )
        data = self.post_sign_in("amit", "long-password-1").json()
        self.assertEqual(data["role"], "supervisor")
        self.assertEqual(data["name"], "Amit Deng")
        self.assertEqual(data["cards"], {"adm": 0, "nat": 1, "sup": 1})

    def test_page_permissions_are_returned(self):
        user = User.objects.create_user("sam", password="long-password-1")
        PagePermission.objects.create(
            profile=user.profile, page_key="new", can_view=True, can_edit=True
        )
        data = self.post_sign_in("sam", "long-password-1").json()
        self.assertEqual(data["perms"], {"new": {"v": 1, "e": 1, "d": 0}})

    def test_wrong_password(self):
        User.objects.create_user("amit", password="long-password-1")
        response = self.post_sign_in("amit", "nope")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"], "Incorrect username or password.")

    def test_inactive_profile_cannot_sign_in(self):
        user = User.objects.create_user("old", password="long-password-1")
        UserProfile.objects.filter(user=user).update(status="Inactive")
        self.assertEqual(self.post_sign_in("old", "long-password-1").status_code, 403)

    def test_session_and_sign_out(self):
        User.objects.create_user("amit", password="long-password-1")
        self.assertFalse(self.client.get(reverse("pages:session")).json()["authenticated"])
        self.post_sign_in("amit", "long-password-1")
        self.assertEqual(self.client.get(reverse("pages:session")).json()["username"], "amit")
        self.client.post(reverse("pages:sign_out"))
        self.assertFalse(self.client.get(reverse("pages:session")).json()["authenticated"])
        actions = list(ActivityLog.objects.values_list("action", flat=True))
        self.assertEqual(sorted(actions), ["Signed in", "Signed out"])

    def test_get_is_not_allowed_on_sign_in(self):
        self.assertEqual(self.client.get(reverse("pages:sign_in")).status_code, 405)
