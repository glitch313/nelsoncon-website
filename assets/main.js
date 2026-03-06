(function () {
  setFooterYear();
  initRsvpForm();
  initMemoriesTabs();

  function setFooterYear() {
    const yearNodes = document.querySelectorAll("[data-year]");
    const year = new Date().getFullYear();
    yearNodes.forEach((node) => {
      node.textContent = String(year);
    });
  }

  function initRsvpForm() {
    const form = document.getElementById("rsvpForm");
    const message = document.getElementById("rsvpMessage");

    if (!form || !message) {
      return;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const fullName = form.fullName.value.trim();
      const email = form.email.value.trim();
      const ticketType = form.ticketType.value.trim();
      const paymentMethod = form.paymentMethod.value.trim();

      if (!fullName || !email || !ticketType || !paymentMethod) {
        message.className = "form-message error";
        message.textContent = "Please complete all fields before submitting.";
        return;
      }

      message.className = "form-message ok";
      message.textContent = `Thanks, ${fullName}. Your ${ticketType} RSVP was recorded (${paymentMethod}).`;
      form.reset();
    });
  }

  function initMemoriesTabs() {
    const container = document.querySelector("[data-memories-tabs]");
    if (!container) {
      return;
    }

    const tabs = Array.from(container.querySelectorAll("[data-tab-year]"));
    const panels = Array.from(container.querySelectorAll("[data-panel-year]"));

    function setActiveYear(year) {
      tabs.forEach((tab) => {
        const active = tab.dataset.tabYear === year;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });

      panels.forEach((panel) => {
        const active = panel.dataset.panelYear === year;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        setActiveYear(tab.dataset.tabYear);
      });
    });

    const initialTab = tabs.find((tab) => tab.classList.contains("is-active")) || tabs[0];
    if (initialTab) {
      setActiveYear(initialTab.dataset.tabYear);
    }
  }
})();
