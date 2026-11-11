document.addEventListener("DOMContentLoaded", function () {
  const wizard = document.querySelector(".wizard-numbered");
  if (!wizard) return;

  const form = document.getElementById("mobile-money-form");
  if (!form) return;

  const stepper = new Stepper(wizard, {
    linear: false,
    animation: true
  });

  const nextBtns = wizard.querySelectorAll(".btn-next");
  const prevBtns = wizard.querySelectorAll(".btn-prev");

  function getCurrentStep() {
    return wizard.querySelector(".content.active") || wizard.querySelector(".content");
  }

  function markInvalid(field) {
    field.classList.add("is-invalid");

    if (field.classList.contains("selectpicker")) {
      const bootstrapSelect = field.parentElement.querySelector(".dropdown-toggle");
      if (bootstrapSelect) {
        bootstrapSelect.classList.add("is-invalid");
      }
    }
  }

  function clearInvalid(field) {
    field.classList.remove("is-invalid");

    if (field.classList.contains("selectpicker")) {
      const bootstrapSelect = field.parentElement.querySelector(".dropdown-toggle");
      if (bootstrapSelect) {
        bootstrapSelect.classList.remove("is-invalid");
      }
    }
  }

  function validateStep(step) {
    if (!step) return true;

    let valid = true;
    const fields = step.querySelectorAll("input, select, textarea");

    fields.forEach(field => {
      if (field.type === "hidden" || field.disabled) return;

      clearInvalid(field);

      if (field.hasAttribute("required")) {
        const value = (field.value || "").trim();

        if (!value) {
          markInvalid(field);
          valid = false;
        }
      }
    });

    return valid;
  }

  nextBtns.forEach(btn => {
    btn.type = "button";
    btn.addEventListener("click", function (e) {
      e.preventDefault();

      const currentStep = getCurrentStep();

      if (validateStep(currentStep)) {
        stepper.next();
      }
    });
  });

  prevBtns.forEach(btn => {
    btn.type = "button";
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      stepper.previous();
    });
  });

  form.addEventListener("submit", function (e) {
    const step1 = document.getElementById("account-details");
    const step2 = document.getElementById("personal-info");

    const validStep1 = validateStep(step1);
    const validStep2 = validateStep(step2);

    if (!validStep1) {
      e.preventDefault();
      e.stopPropagation();
      stepper.to(1);
      return;
    }

    if (!validStep2) {
      e.preventDefault();
      e.stopPropagation();
      stepper.to(2);
      return;
    }

    console.log("Submitting form...");
  });

  form.querySelectorAll("input, select, textarea").forEach(field => {
    field.addEventListener("input", function () {
      if ((field.value || "").trim() !== "") {
        clearInvalid(field);
      }
    });

    field.addEventListener("change", function () {
      if ((field.value || "").trim() !== "") {
        clearInvalid(field);
      }
    });
  });

  if (window.jQuery && $('.selectpicker').length) {
    $('.selectpicker').on('changed.bs.select', function () {
      clearInvalid(this);
    });
  }
});