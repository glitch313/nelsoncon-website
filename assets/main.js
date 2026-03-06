(function () {
  const yearNodes = document.querySelectorAll("[data-year]");
  const year = new Date().getFullYear();
  yearNodes.forEach((node) => {
    node.textContent = String(year);
  });

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
})();
