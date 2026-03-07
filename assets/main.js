(function () {
  setFooterYear();
  initRsvpForm();
  initMemoriesTabs();
  initMemoryGalleries();

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

  async function initMemoryGalleries() {
    const galleries = Array.from(
      document.querySelectorAll(".memory-gallery[data-memory-type][data-memory-year]")
    );

    if (galleries.length === 0) {
      return;
    }

    let manifest;
    try {
      const response = await fetch("./assets/memories/photo-manifest.json", {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      manifest = await response.json();
    } catch {
      return;
    }

    const lightbox = buildLightbox();

    galleries.forEach((gallery) => {
      const type = gallery.dataset.memoryType;
      const year = gallery.dataset.memoryYear;
      const files = (((manifest || {})[type] || {})[year] || []).filter(Boolean);

      gallery.innerHTML = "";

      if (files.length === 0) {
        return;
      }

      files.forEach((src, idx) => {
        const link = document.createElement("button");
        link.type = "button";
        link.className = "memory-photo-link";
        link.setAttribute("aria-label", `Open ${type} ${year} photo ${idx + 1}`);

        const img = document.createElement("img");
        img.className = "memory-photo";
        img.src = src;
        img.alt = `Nelsoncon ${type === "winter" ? "Winter " : ""}${year} photo ${idx + 1}`;
        img.loading = "lazy";

        link.addEventListener("click", () => {
          openLightbox(lightbox, src, img.alt);
        });

        link.appendChild(img);
        gallery.appendChild(link);
      });
    });
  }

  function buildLightbox() {
    let overlay = document.getElementById("memoryLightbox");
    if (overlay) {
      return overlay;
    }

    overlay = document.createElement("div");
    overlay.id = "memoryLightbox";
    overlay.className = "memory-lightbox";
    overlay.hidden = true;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "memory-lightbox-close";
    closeBtn.setAttribute("aria-label", "Close full image");
    closeBtn.textContent = "x";

    const image = document.createElement("img");
    image.className = "memory-lightbox-image";
    image.alt = "";

    overlay.appendChild(closeBtn);
    overlay.appendChild(image);
    document.body.appendChild(overlay);

    function closeLightbox() {
      overlay.hidden = true;
      image.removeAttribute("src");
      document.body.classList.remove("lightbox-open");
    }

    closeBtn.addEventListener("click", closeLightbox);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeLightbox();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hidden) {
        closeLightbox();
      }
    });

    overlay.closeLightbox = closeLightbox;
    return overlay;
  }

  function openLightbox(overlay, src, alt) {
    const image = overlay.querySelector(".memory-lightbox-image");
    image.src = src;
    image.alt = alt;
    overlay.hidden = false;
    document.body.classList.add("lightbox-open");
  }
})();
