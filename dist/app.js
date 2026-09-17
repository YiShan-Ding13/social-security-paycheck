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
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }

  return { calculateBenefit, money };
});
