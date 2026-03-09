(function () {
  const IMAGE_EXT_RE = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?.*)?$/i;
  const VIDEO_EXT_RE = /\.(mp4|webm)(\?.*)?$/i;
  const RSVP_ALLOWED_TICKETS = new Set(["Normal Ticket", "Private Room"]);
  const RSVP_NAME_MAX_LENGTH = 80;
  const RSVP_NAME_RE = /^[A-Za-z0-9 .,'-]{2,80}$/;
  const RSVP_MIN_FILL_MS = 1200;
  const RSVP_REQUEST_TIMEOUT_MS = 10000;

  setFooterYear();
  initRsvpForm();
  initMemoriesTabs();
  initMemoryGalleries();
  initVenuePhotoGallery();
  initHideOnErrorMedia();

  function setFooterYear() {
    const yearNodes = document.querySelectorAll("[data-year]");
    const year = new Date().getFullYear();
    yearNodes.forEach((node) => {
      node.textContent = String(year);
    });
  }

  function getRsvpConfig() {
    const config = window.NELSONCON_RSVP_CONFIG || {};

    return {
      supabaseUrl: typeof config.supabaseUrl === "string" ? config.supabaseUrl.trim() : "",
      anonKey: typeof config.anonKey === "string" ? config.anonKey.trim() : "",
      table:
        typeof config.table === "string" && config.table.trim().length > 0
          ? config.table.trim()
          : "rsvps",
    };
  }

  async function saveRsvpToSupabase(entry) {
    const config = getRsvpConfig();
    if (!config.supabaseUrl || !config.anonKey) {
      return { ok: false, reason: "not_configured" };
    }

    const baseUrl = config.supabaseUrl.replace(/\/+$/, "");
    const endpoint = `${baseUrl}/rest/v1/${encodeURIComponent(config.table)}`;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, RSVP_REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify([entry]),
      });

      if (!response.ok) {
        let errorPayload = null;
        try {
          errorPayload = await response.json();
        } catch {
          errorPayload = null;
        }

        const errorCode = typeof errorPayload?.code === "string" ? errorPayload.code : "";
        const errorMessage = typeof errorPayload?.message === "string" ? errorPayload.message : "";
        if (response.status === 409 || errorCode === "23505" || /duplicate/i.test(errorMessage)) {
          return { ok: false, reason: "duplicate" };
        }

        return { ok: false, reason: "request_failed" };
      }

      return { ok: true };
    } catch {
      return { ok: false, reason: "network_error" };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function normalizeRsvpName(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function initRsvpForm() {
    const form = document.getElementById("rsvpForm");
    const message = document.getElementById("rsvpMessage");

    if (!form || !message) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const honeypotField = form.querySelector('input[name="website"]');
    const formLoadedAt = Date.now();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const fullName = normalizeRsvpName(form.fullName.value);
      const ticketType = String(form.ticketType.value || "").trim();

      if (!fullName || !ticketType) {
        message.className = "form-message error";
        message.textContent = "Please complete all fields before submitting.";
        return;
      }

      if (fullName.length > RSVP_NAME_MAX_LENGTH || !RSVP_NAME_RE.test(fullName)) {
        message.className = "form-message error";
        message.textContent = "Please enter a valid full name.";
        return;
      }

      if (!RSVP_ALLOWED_TICKETS.has(ticketType)) {
        message.className = "form-message error";
        message.textContent = "Please choose a valid ticket type.";
        return;
      }

      if ((honeypotField && honeypotField.value.trim()) || Date.now() - formLoadedAt < RSVP_MIN_FILL_MS) {
        message.className = "form-message ok";
        message.textContent = "Thanks. Your RSVP was recorded.";
        form.reset();
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
      }

      const result = await saveRsvpToSupabase({
        full_name: fullName,
        ticket_type: ticketType,
        source_page: "/rsvp-payment.html",
      });

      if (result.ok) {
        message.className = "form-message ok";
        message.textContent = `Thanks, ${fullName}. Your ${ticketType} RSVP was recorded.`;
        form.reset();
      } else if (result.reason === "not_configured") {
        message.className = "form-message error";
        message.textContent = "RSVP storage is not configured yet. Add Supabase URL and anon key in assets/rsvp-config.js.";
      } else if (result.reason === "duplicate") {
        message.className = "form-message error";
        message.textContent = "An RSVP already exists for this name.";
      } else {
        message.className = "form-message error";
        message.textContent = "Could not submit RSVP right now. Please try again in a moment.";
      }

      if (submitButton) {
        submitButton.disabled = false;
      }
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

    let activeYear = "";

    function setActiveYear(year, { focusTab = false } = {}) {
      if (!year) {
        return;
      }

      if (year === activeYear) {
        const activeTabOnly = tabs.find((tab) => tab.dataset.tabYear === year);
        if (activeTabOnly && focusTab) {
          activeTabOnly.focus();
        }
        return;
      }

      activeYear = year;
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

    const requestedYear = new URLSearchParams(window.location.search).get("year") || "";
    const initialTab =
      tabs.find((tab) => tab.dataset.tabYear === requestedYear.trim()) ||
      tabs.find((tab) => tab.classList.contains("is-active")) ||
      tabs[0];
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


  function renderGalleryMessageForAll(galleries, message) {
    galleries.forEach((gallery) => {
      renderGalleryMessage(gallery, message);
    });
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = Math.imul(state, 1664525) + 1013904223;
      return (state >>> 0) / 4294967296;
    };
  }


  const galleryLayoutFrames = new WeakMap();

  function scheduleGalleryLayout(gallery) {
    if (galleryLayoutFrames.has(gallery)) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      galleryLayoutFrames.delete(gallery);
      rebalanceGalleryPortraitFlow(gallery);
    });
    galleryLayoutFrames.set(gallery, frame);
  }

  function clearGallerySpanOverrides(gallery) {
    const links = Array.from(gallery.querySelectorAll(".memory-photo-link"));
    links.forEach((link) => {
      link.classList.remove("is-row-fill");
      link.style.removeProperty("--tile-span");
    });
  }

  function getGalleryTileSpan(link) {
    return link.classList.contains("is-portrait") ? 1 : 2;
  }

  function distributeRowSpan(row) {
    const spans = row.map((link) => getGalleryTileSpan(link));
    const maxPrimary = row.map((link) => (link.classList.contains("is-portrait") ? 2 : 3));
    const maxFallback = row.map((link) => (link.classList.contains("is-portrait") ? 3 : 6));
    let total = spans.reduce((sum, span) => sum + span, 0);
    let extra = 6 - total;

    if (extra <= 0) {
      return spans;
    }

    for (let i = 0; i < spans.length && extra > 0; i += 1) {
      if (spans[i] < maxPrimary[i]) {
        spans[i] += 1;
        extra -= 1;
      }
    }

    // Rare fallback when the row still has space to fill.
    while (extra > 0) {
      let changed = false;
      for (let i = 0; i < spans.length && extra > 0; i += 1) {
        if (spans[i] < maxFallback[i]) {
          spans[i] += 1;
          extra -= 1;
          changed = true;
        }
      }

      if (!changed) {
        break;
      }
    }

    total = spans.reduce((sum, span) => sum + span, 0);
    if (total < 6 && spans.length > 0) {
      spans[0] += 6 - total;
    }

    return spans;
  }

  function buildGalleryRows(links) {
    const rows = [];
    let row = [];
    let used = 0;

    links.forEach((item) => {
      const span = getGalleryTileSpan(item);

      if (row.length > 0 && used + span > 6) {
        rows.push(row);
        row = [];
        used = 0;
      }

      row.push(item);
      used += span;

      if (used === 6) {
        rows.push(row);
        row = [];
        used = 0;
      }
    });

    if (row.length > 0) {
      rows.push(row);
    }

    return rows;
  }

  function rebalanceGalleryPortraitFlow(gallery) {
    const links = Array.from(gallery.querySelectorAll(".memory-photo-link"));
    if (links.length < 2) {
      return;
    }

    clearGallerySpanOverrides(gallery);

    const sortedLinks = links.slice().sort((a, b) => {
      return Number(a.dataset.memoryIndex || 0) - Number(b.dataset.memoryIndex || 0);
    });

    const rows = buildGalleryRows(sortedLinks);
    const fragment = document.createDocumentFragment();

    rows.forEach((row) => {
      const spanPlan = distributeRowSpan(row);
      row.forEach((link, index) => {
        const base = getGalleryTileSpan(link);
        const target = spanPlan[index];
        if (target !== base) {
          link.classList.add("is-row-fill");
          link.style.setProperty("--tile-span", String(target));
        }
        fragment.appendChild(link);
      });
    });

    gallery.appendChild(fragment);
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
        renderGalleryMessageForAll(galleries, "Could not load media right now.");
        return;
      }
      manifest = await response.json();
    } catch {
      renderGalleryMessageForAll(galleries, "Could not load media right now.");
      return;
    }

    const lightbox = buildLightbox();

    galleries.forEach((gallery) => {
      const type = gallery.dataset.memoryType;
      const year = gallery.dataset.memoryYear;
      let entries = normalizeMediaEntries(
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
        link.dataset.memoryIndex = String(idx);

        const mediaType = getMediaType(entry.src, entry.type);
        const label = `Nelsoncon ${type === "winter" ? "Winter " : ""}${year} ${
          mediaType === "video" ? "video" : "photo"
        } ${idx + 1}`;

        const itemRandom = createSeededRandom(hashString(`${type}-${year}-${idx}-${entry.src}`));

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
            const ratio = video.videoWidth / Math.max(1, video.videoHeight);
            applyOrientationClass(link, ratio);
            applyPreviewZoom(link, ratio, itemRandom);
            scheduleGalleryLayout(gallery);
          });
          mediaEl = video;
        } else {
          const img = document.createElement("img");
          img.className = "memory-photo";
          img.src = entry.src;
          img.alt = label;
          img.loading = "lazy";
          img.decoding = "async";
          img.addEventListener("load", () => {
            const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
            applyOrientationClass(link, ratio);
            applyPreviewZoom(link, ratio, itemRandom);
            scheduleGalleryLayout(gallery);
          });
          mediaEl = img;
        }

        link.addEventListener("click", () => {
          openLightbox(lightbox, entries, idx, type, year);
        });
        attachPreviewZoomControls(link);

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
      scheduleGalleryLayout(gallery);
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
  function initHideOnErrorMedia() {
    const errorImages = Array.from(document.querySelectorAll("img[data-hide-on-error]"));
    if (errorImages.length === 0) {
      return;
    }

    const hideImageContainer = (img) => {
      const figure = img.closest("figure");
      if (figure) {
        figure.hidden = true;
        return;
      }

      img.hidden = true;
    };

    errorImages.forEach((img) => {
      img.addEventListener("error", () => {
        hideImageContainer(img);
      });

      if (img.complete && img.naturalWidth === 0) {
        hideImageContainer(img);
      }
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

  function applyPreviewZoom(link, ratio, random) {
    let scale = 1;
    if (ratio >= 1.35) {
      scale = 1.03 + random() * 0.09;
    } else if (ratio <= 0.82) {
      scale = 0.97 + random() * 0.06;
    } else {
      scale = 1.0 + random() * 0.06;
    }

    const posX = 50 + (random() - 0.5) * 14;
    const posY = 50 + (random() - 0.5) * 12;

    link.style.setProperty("--preview-scale", scale.toFixed(3));
    link.style.setProperty("--preview-pos-x", `${posX.toFixed(1)}%`);
    link.style.setProperty("--preview-pos-y", `${posY.toFixed(1)}%`);
  }

  function attachPreviewZoomControls(link) {
    link.addEventListener(
      "wheel",
      (event) => {
        if (!event.ctrlKey && !event.shiftKey) {
          return;
        }

        event.preventDefault();
        const current = Number(link.style.getPropertyValue("--preview-scale")) || 1;
        const delta = event.deltaY < 0 ? 0.05 : -0.05;
        const next = Math.min(1.35, Math.max(0.85, current + delta));
        link.style.setProperty("--preview-scale", next.toFixed(3));
      },
      { passive: false }
    );

    link.addEventListener("dblclick", (event) => {
      event.preventDefault();
      link.style.removeProperty("--preview-scale");
      link.style.removeProperty("--preview-pos-x");
      link.style.removeProperty("--preview-pos-y");
    });
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

