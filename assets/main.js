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
          openLightbox(lightbox, files, idx, type, year);
        });

        link.appendChild(img);
        gallery.appendChild(link);
      });
    });
  }

  function buildLightbox() {
    const existing = document.getElementById("memoryLightbox");
    if (existing && existing._lightboxApi) {
      return existing._lightboxApi;
    }

    const overlay = document.createElement("div");
    overlay.id = "memoryLightbox";
    overlay.className = "memory-lightbox";
    overlay.hidden = true;

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "memory-lightbox-nav prev";
    prevBtn.setAttribute("aria-label", "Previous image");
    prevBtn.textContent = "<";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "memory-lightbox-nav next";
    nextBtn.setAttribute("aria-label", "Next image");
    nextBtn.textContent = ">";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "memory-lightbox-close";
    closeBtn.setAttribute("aria-label", "Close full image");
    closeBtn.textContent = "x";

    const image = document.createElement("img");
    image.className = "memory-lightbox-image";
    image.alt = "";

    overlay.appendChild(prevBtn);
    overlay.appendChild(nextBtn);
    overlay.appendChild(closeBtn);
    overlay.appendChild(image);
    document.body.appendChild(overlay);

    const state = {
      overlay,
      image,
      prevBtn,
      nextBtn,
      files: [],
      index: 0,
      labelPrefix: "",
    };

    function renderCurrent() {
      if (!state.files.length) {
        return;
      }

      state.image.src = state.files[state.index];
      state.image.alt = `${state.labelPrefix} photo ${state.index + 1} of ${state.files.length}`;
      state.prevBtn.disabled = state.index === 0;
      state.nextBtn.disabled = state.index === state.files.length - 1;
    }

    function closeLightbox() {
      state.overlay.hidden = true;
      state.image.removeAttribute("src");
      document.body.classList.remove("lightbox-open");
    }

    function step(delta) {
      const nextIndex = state.index + delta;
      if (nextIndex < 0 || nextIndex >= state.files.length) {
        return;
      }

      state.index = nextIndex;
      renderCurrent();
    }

    const api = {
      open(files, startIndex, labelPrefix) {
        state.files = files.slice();
        state.index = startIndex;
        state.labelPrefix = labelPrefix;
        renderCurrent();
        state.overlay.hidden = false;
        document.body.classList.add("lightbox-open");
      },
      close: closeLightbox,
      prev() {
        step(-1);
      },
      next() {
        step(1);
      },
      isOpen() {
        return !state.overlay.hidden;
      },
    };

    closeBtn.addEventListener("click", closeLightbox);
    prevBtn.addEventListener("click", () => api.prev());
    nextBtn.addEventListener("click", () => api.next());

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeLightbox();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!api.isOpen()) {
        return;
      }

      if (event.key === "Escape") {
        closeLightbox();
      } else if (event.key === "ArrowLeft") {
        api.prev();
      } else if (event.key === "ArrowRight") {
        api.next();
      }
    });

    overlay._lightboxApi = api;
    return api;
  }

  function openLightbox(lightbox, files, index, type, year) {
    const labelPrefix = `Nelsoncon ${type === "winter" ? "Winter " : ""}${year}`;
    lightbox.open(files, index, labelPrefix);
  }
})();
