(function () {
  const IMAGE_EXT_RE = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?.*)?$/i;
  const VIDEO_EXT_RE = /\.(mp4|webm)(\?.*)?$/i;

  setFooterYear();
  initRsvpForm();
  initMemoriesTabs();
  initMemoryGalleries();
  initVenuePhotoGallery();

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
    if (tabs.length === 0 || panels.length === 0) {
      return;
    }

    const attendeesList = document.querySelector("[data-attendees-list]");
    const attendeesHeading = document.querySelector(".attendees-panel h3");
    const isWinter = tabs.some((tab) =>
      (tab.getAttribute("aria-controls") || "").startsWith("wmem-")
    );

    function formatAttendeesHeading(year) {
      const numericYear = Number(year);

      if (isWinter) {
        const winterNumber = Number.isFinite(numericYear) ? numericYear - 2022 : 1;
        return `Nelsoncon Winter ${Math.max(1, winterNumber)} Attendees`;
      }

      const nelsonconNumber = Number.isFinite(numericYear) ? numericYear - 2017 : 1;
      if (nelsonconNumber <= 1) {
        return "Nelsoncon Attendees";
      }

      return `Nelsoncon ${nelsonconNumber} Attendees`;
    }

    function renderAttendees(activeTab, year) {
      if (attendeesHeading) {
        attendeesHeading.textContent = formatAttendeesHeading(year);
      }

      if (!attendeesList) {
        return;
      }

      const raw = (activeTab?.dataset.attendees || "").trim();
      const attendees = raw
        ? raw.split("|").map((entry) => entry.trim()).filter(Boolean)
        : [`Add attendee names for ${year}.`];

      attendeesList.innerHTML = "";
      attendees.forEach((attendee) => {
        const item = document.createElement("li");
        item.textContent = attendee;
        attendeesList.appendChild(item);
      });
    }

    function setActiveYear(year, { focusTab = false } = {}) {
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

      const activeTab = tabs.find((tab) => tab.dataset.tabYear === year);
      if (activeTab && focusTab) {
        activeTab.focus();
      }

      renderAttendees(activeTab, year);
    }

    function activateTabByIndex(index, { focusTab = false } = {}) {
      const normalizedIndex = (index + tabs.length) % tabs.length;
      const targetTab = tabs[normalizedIndex];
      if (!targetTab) {
        return;
      }

      setActiveYear(targetTab.dataset.tabYear, { focusTab });
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => {
        setActiveYear(tab.dataset.tabYear);
      });

      tab.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          activateTabByIndex(index - 1, { focusTab: true });
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          activateTabByIndex(index + 1, { focusTab: true });
        } else if (event.key === "Home") {
          event.preventDefault();
          activateTabByIndex(0, { focusTab: true });
        } else if (event.key === "End") {
          event.preventDefault();
          activateTabByIndex(tabs.length - 1, { focusTab: true });
        }
      });
    });

    const initialTab = tabs.find((tab) => tab.classList.contains("is-active")) || tabs[0];
    if (initialTab) {
      setActiveYear(initialTab.dataset.tabYear);
    }
  }

  function renderGalleryMessage(gallery, message) {
    gallery.innerHTML = "";
    const note = document.createElement("p");
    note.className = "memory-gallery-empty";
    note.textContent = message;
    gallery.appendChild(note);
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
        cache: "no-cache",
      });
      if (!response.ok) {
        galleries.forEach((gallery) => {
          renderGalleryMessage(gallery, "Could not load media right now.");
        });
        return;
      }
      manifest = await response.json();
    } catch {
      galleries.forEach((gallery) => {
        renderGalleryMessage(gallery, "Could not load media right now.");
      });
      return;
    }

    const lightbox = buildLightbox();

    galleries.forEach((gallery) => {
      const type = gallery.dataset.memoryType;
      const year = gallery.dataset.memoryYear;
      const entries = normalizeMediaEntries(
        (((manifest || {})[type] || {})[year] || []).filter(Boolean)
      );

      gallery.innerHTML = "";

      if (entries.length === 0) {
        renderGalleryMessage(gallery, `No media uploaded for ${year} yet.`);
        return;
      }

      const fragment = document.createDocumentFragment();

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
          link.classList.add("is-video");
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

        if (mediaType === "video") {
          const playIcon = document.createElement("span");
          playIcon.className = "memory-video-play";
          playIcon.setAttribute("aria-hidden", "true");
          link.appendChild(playIcon);
        }

        fragment.appendChild(link);
      });

      gallery.appendChild(fragment);
    });
  }

  function initVenuePhotoGallery() {
    const buttons = Array.from(document.querySelectorAll(".venue-photo-grid [data-venue-photo]"));
    if (buttons.length === 0) {
      return;
    }

    const entries = buttons
      .map((button) => ({ src: (button.dataset.venuePhoto || "").trim(), type: "image" }))
      .filter((entry) => entry.src.length > 0);

    if (entries.length === 0) {
      return;
    }

    const lightbox = buildLightbox();

    buttons.forEach((button, index) => {
      if (!button.dataset.venuePhoto) {
        return;
      }

      button.addEventListener("click", () => {
        lightbox.open(entries, index, "Host Venue");
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
    const seen = new Set();

    return rawEntries
      .map((entry) => {
        if (typeof entry === "string") {
          const src = entry.trim();
          if (!src) {
            return null;
          }

          return { src, type: getMediaType(src) };
        }

        if (!entry || typeof entry.src !== "string") {
          return null;
        }

        const src = entry.src.trim();
        if (!src) {
          return null;
        }

        return {
          src,
          type: getMediaType(src, entry.type),
        };
      })
      .filter((entry) => {
        if (!entry || seen.has(entry.src)) {
          return false;
        }

        seen.add(entry.src);
        return true;
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

