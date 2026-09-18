(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BenefitLens = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function calculateBenefit(currentBenefit, colaPercent, partBPremium) {
    const benefit = Number(currentBenefit);
    const cola = Number(colaPercent);
    const premium = Number(partBPremium);
    if (!Number.isFinite(benefit) || benefit <= 0 || benefit > 100000) throw new RangeError("Benefit must be between $1 and $100,000.");
    if (!Number.isFinite(cola) || cola < 0 || cola > 20) throw new RangeError("COLA must be between 0% and 20%.");
    if (!Number.isFinite(premium) || premium < 0 || premium > 5000) throw new RangeError("Premium must be between $0 and $5,000.");
    const gross = benefit * (1 + cola / 100);
    const monthlyIncrease = gross - benefit;
    return {
      gross,
      net: Math.max(0, gross - premium),
      monthlyIncrease,
      annualIncrease: monthlyIncrease * 12
    };
  }

  function money(value, sign) {
    const formatted = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sign && value >= 0 ? "+" : value < 0 ? "-" : ""}$${formatted}`;
  }

  const FEDERAL_HOLIDAYS_2027 = new Set([
    "2027-01-01", "2027-01-18", "2027-02-15", "2027-05-31",
    "2027-06-18", "2027-07-05", "2027-09-06", "2027-10-11",
    "2027-11-11", "2027-11-25", "2027-12-24"
  ]);

  function isoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function previousBusinessDay(date) {
    const result = new Date(date.getTime());
    while (result.getUTCDay() === 0 || result.getUTCDay() === 6 || FEDERAL_HOLIDAYS_2027.has(isoDate(result))) {
      result.setUTCDate(result.getUTCDate() - 1);
    }
    return result;
  }

  function nthWednesday(year, month, nth) {
    const first = new Date(Date.UTC(year, month, 1));
    const offset = (3 - first.getUTCDay() + 7) % 7;
    return new Date(Date.UTC(year, month, 1 + offset + (nth - 1) * 7));
  }

  function getPaymentDates(type, birthDay) {
    const day = Number(birthDay);
    if (type === "birthday" && (!Number.isInteger(day) || day < 1 || day > 31)) throw new RangeError("Day of birth must be from 1 to 31.");
    const cycle = day <= 10 ? 2 : day <= 20 ? 3 : 4;
    return Array.from({ length: 12 }, (_, month) => {
      let date;
      if (type === "birthday") date = nthWednesday(2027, month, cycle);
      else if (type === "legacy") date = previousBusinessDay(new Date(Date.UTC(2027, month, 3)));
      else if (type === "ssi") date = previousBusinessDay(new Date(Date.UTC(2027, month, 1)));
      else throw new RangeError("Unknown payment type.");
      return { month, date, iso: isoDate(date) };
    });
  }

  function readableDate(date) {
    const options = { timeZone: "UTC", month: "short", day: "numeric", weekday: "short" };
    if (date.getUTCFullYear() !== 2027) options.year = "numeric";
    return date.toLocaleDateString("en-US", options);
  }

  function init() {
    const form = document.getElementById("cola-form");
    if (!form) return;
    const benefitInput = document.getElementById("current-benefit");
    const premiumInput = document.getElementById("part-b");
    const scenarioInputs = Array.from(form.querySelectorAll('input[name="scenario"]'));
    const output = {
      net: document.getElementById("net-result"),
      gross: document.getElementById("gross-result"),
      monthly: document.getElementById("monthly-increase"),
      annual: document.getElementById("annual-increase"),
      scenario: document.getElementById("scenario-result"),
      formula: document.getElementById("formula-result")
    };

    function showError(input, message) {
      const error = document.getElementById(input.id === "part-b" ? "part-b-error" : "benefit-error");
      error.textContent = message;
      input.setAttribute("aria-invalid", message ? "true" : "false");
    }

    function update() {
      const selected = scenarioInputs.find(input => input.checked);
      scenarioInputs.forEach(input => input.closest("label").classList.toggle("selected", input.checked));
      showError(benefitInput, "");
      showError(premiumInput, "");
      try {
        const result = calculateBenefit(benefitInput.value, selected.value, premiumInput.value || 0);
        output.net.textContent = Math.abs(result.net).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        output.gross.textContent = money(result.gross);
        output.monthly.textContent = money(result.monthlyIncrease, true);
        output.annual.textContent = money(result.annualIncrease, true);
        output.scenario.textContent = `${Number(selected.value).toFixed(1)}%`;
        output.formula.textContent = `${money(Number(benefitInput.value))} × ${(1 + Number(selected.value) / 100).toFixed(3)} − ${money(Number(premiumInput.value || 0))}`;
      } catch (error) {
        if (benefitInput.value === "" || Number(benefitInput.value) <= 0 || Number(benefitInput.value) > 100000) showError(benefitInput, "Enter a monthly benefit from $1 to $100,000.");
        if (premiumInput.value !== "" && (Number(premiumInput.value) < 0 || Number(premiumInput.value) > 5000)) showError(premiumInput, "Enter a premium from $0 to $5,000.");
      }
    }

    form.addEventListener("input", update);
    form.addEventListener("change", update);
    update();

    const scheduleForm = document.getElementById("schedule-form");
    if (scheduleForm) {
      const typeInputs = Array.from(scheduleForm.querySelectorAll('input[name="payment-type"]'));
      const birthdayWrap = document.getElementById("birthday-wrap");
      const birthdayInput = document.getElementById("birth-day");
      const birthdayError = document.getElementById("birth-day-error");
      const scheduleGrid = document.getElementById("schedule-grid");
      const scheduleSummary = document.getElementById("schedule-summary");

      function renderSchedule() {
        const type = typeInputs.find(input => input.checked).value;
        const needsBirthday = type === "birthday";
        birthdayWrap.hidden = !needsBirthday;
        birthdayInput.disabled = !needsBirthday;
        birthdayError.textContent = "";
        birthdayInput.setAttribute("aria-invalid", "false");
        try {
          const dates = getPaymentDates(type, birthdayInput.value);
          const cycleText = type === "birthday"
            ? `${Number(birthdayInput.value) <= 10 ? "Second" : Number(birthdayInput.value) <= 20 ? "Third" : "Fourth"} Wednesday schedule`
            : type === "legacy" ? "Third-of-month schedule" : "SSI first-of-month schedule";
          scheduleSummary.textContent = cycleText;
          scheduleGrid.innerHTML = dates.map(({ month, date }) => `
            <article class="date-card">
              <span>${new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2027, month, 1)))}</span>
              <strong>${readableDate(date)}</strong>
            </article>`).join("");
        } catch (error) {
          birthdayError.textContent = "Enter a day from 1 to 31.";
          birthdayInput.setAttribute("aria-invalid", "true");
          scheduleGrid.innerHTML = "";
          scheduleSummary.textContent = "Enter your day of birth to see payment dates.";
        }
      }

      scheduleForm.addEventListener("input", renderSchedule);
      scheduleForm.addEventListener("change", renderSchedule);
      renderSchedule();
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }

  return { calculateBenefit, getPaymentDates, money, nthWednesday, previousBusinessDay };
});
