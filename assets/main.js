(function () {
  const IMAGE_EXT_RE = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?.*)?$/i;
  const VIDEO_EXT_RE = /\.(mp4|webm)(\?.*)?$/i;

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
      const entries = normalizeMediaEntries((((manifest || {})[type] || {})[year] || []).filter(Boolean));

      gallery.innerHTML = "";

      if (entries.length === 0) {
        return;
      }

      entries.forEach((entry, idx) => {
        const link = document.createElement("button");
        link.type = "button";
        link.className = "memory-photo-link is-square";
        link.setAttribute("aria-label", `Open ${type} ${year} media ${idx + 1}`);

        const mediaType = getMediaType(entry.src, entry.type);
        const label = `Nelsoncon ${type === "winter" ? "Winter " : ""}${year} ${
          mediaType === "video" ? "video" : "photo"
        } ${idx + 1}`;

        let mediaEl;
        if (mediaType === "video") {
          const video = document.createElement("video");
          video.className = "memory-photo memory-video";
          video.src = entry.src;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = "metadata";
          video.setAttribute("aria-label", label);
          video.addEventListener("loadedmetadata", () => {
            applyOrientationClass(link, video.videoWidth / Math.max(1, video.videoHeight));
          });
          mediaEl = video;
        } else {
          const img = document.createElement("img");
          img.className = "memory-photo";
          img.src = entry.src;
          img.alt = label;
          img.loading = "lazy";
          img.addEventListener("load", () => {
            applyOrientationClass(link, img.naturalWidth / Math.max(1, img.naturalHeight));
          });
          mediaEl = img;
        }

        link.addEventListener("click", () => {
          openLightbox(lightbox, entries, idx, type, year);
        });

        link.appendChild(mediaEl);
        gallery.appendChild(link);
      });
    });
  }

  function applyOrientationClass(link, ratio) {
    link.classList.remove("is-portrait", "is-landscape", "is-square");
    if (ratio <= 0.82) {
      link.classList.add("is-portrait");
    } else if (ratio >= 1.35) {
      link.classList.add("is-landscape");
    } else {
      link.classList.add("is-square");
    }
  }

  function getMediaType(src, explicitType) {
    if (explicitType === "video" || explicitType === "image") {
      return explicitType;
    }

    if (VIDEO_EXT_RE.test(src)) {
      return "video";
    }

    if (IMAGE_EXT_RE.test(src)) {
      return "image";
    }

    return "image";
  }

  function normalizeMediaEntries(rawEntries) {
    return rawEntries
      .map((entry) => {
        if (typeof entry === "string") {
          return { src: entry, type: getMediaType(entry) };
        }

        if (!entry || typeof entry.src !== "string") {
          return null;
        }

        return {
          src: entry.src,
          type: getMediaType(entry.src, entry.type),
        };
      })
      .filter(Boolean);
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

    const video = document.createElement("video");
    video.className = "memory-lightbox-video";
    video.controls = true;
    video.preload = "metadata";
    video.playsInline = true;
    video.hidden = true;

    overlay.appendChild(prevBtn);
    overlay.appendChild(nextBtn);
    overlay.appendChild(closeBtn);
    overlay.appendChild(image);
    overlay.appendChild(video);
    document.body.appendChild(overlay);

    const state = {
      overlay,
      image,
      video,
      prevBtn,
      nextBtn,
      entries: [],
      index: 0,
      labelPrefix: "",
    };

    function stopVideoPlayback() {
      state.video.pause();
      state.video.removeAttribute("src");
      state.video.load();
    }

    function renderCurrent() {
      if (!state.entries.length) {
        return;
      }

      const current = state.entries[state.index];
      const mediaType = getMediaType(current.src, current.type);
      const label = `${state.labelPrefix} ${mediaType === "video" ? "video" : "photo"} ${
        state.index + 1
      } of ${state.entries.length}`;

      if (mediaType === "video") {
        state.image.hidden = true;
        state.image.removeAttribute("src");
        stopVideoPlayback();
        state.video.hidden = false;
        state.video.src = current.src;
        state.video.setAttribute("aria-label", label);
        state.video.play().catch(() => {});
      } else {
        stopVideoPlayback();
        state.video.hidden = true;
        state.image.hidden = false;
        state.image.src = current.src;
        state.image.alt = label;
      }

      state.prevBtn.disabled = state.index === 0;
      state.nextBtn.disabled = state.index === state.entries.length - 1;
    }

    function closeLightbox() {
      state.overlay.hidden = true;
      stopVideoPlayback();
      state.video.hidden = true;
      state.image.removeAttribute("src");
      document.body.classList.remove("lightbox-open");
    }

    function step(delta) {
      const nextIndex = state.index + delta;
      if (nextIndex < 0 || nextIndex >= state.entries.length) {
        return;
      }

      state.index = nextIndex;
      renderCurrent();
    }

    const api = {
      open(entries, startIndex, labelPrefix) {
        state.entries = entries.slice();
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

  function openLightbox(lightbox, entries, index, type, year) {
    const labelPrefix = `Nelsoncon ${type === "winter" ? "Winter " : ""}${year}`;
    lightbox.open(entries, index, labelPrefix);
  }
})();
