/**
 * แอปแชท นิยาย (Novel AI Studio & Chat)
 * Script ควบคุมระบบทั้งหมด: Text Editor, Left Notes, AI Co-Writer Assistant, Storage & Export
 */

document.addEventListener("DOMContentLoaded", () => {
  // ================= State Management (Multi-Story Architecture) =================
  let rawStories = null;
  try {
    rawStories = JSON.parse(localStorage.getItem("novel_stories") || "null");
  } catch {
    rawStories = null;
  }

  // Data Migration: หากยังไม่มี novel_stories ให้นำข้อมูลเดิมมาสร้างเป็น Story แรก
  if (!rawStories || !Array.isArray(rawStories) || rawStories.length === 0) {
    const legacyTitle =
      localStorage.getItem("novel_doc_title") || "การเดินทางข้ามมิติของเร็น";
    const legacyContent =
      localStorage.getItem("novel_doc_content") ||
      `<h1>บทที่ 1: แสงสว่างที่ปลายอุโมงค์</h1>
<p>สายฝนในยามค่ำคืนกระหน่ำเทลงมาบนถนนคอนกรีตที่แตกระแหงของเขตเมืองเก่า เสียงฟ้าร้องคำรามกึกก้องสะท้อนไปทั่วตึกระฟ้าที่ทอดตัวยาวสู่ม่านเมฆสีเทาหม่น <strong>เร็น</strong> กระชับเสื้อโค้ตตัวเก่าสีเข้มให้แนบแน่นขึ้น ขณะที่ก้าวเท้าหลบแอ่งน้ำขังด้วยความเร่งรีบ</p>
<p>ในมือขวาของเขาคือวัตถุโลหะทรงแปดเหลี่ยมขนาดเท่าฝ่ามือ มันกำลังเปล่งแสงเรืองรองสีฟ้าครามจางๆ เป็นจังหวะสม่ำเสมอราวกับมีหัวใจเต้นอยู่ภายใน สิ่งประดิษฐ์ที่ถูกขนานนามว่า <em>"แกนผลึกดารา"</em> ชิ้นนี้ ไม่ควรจะถูกเปิดใช้งานในโลกมนุษย์</p>
<p>"อย่าคิดว่าจะหนีพ้น..." เสียงกระซิบที่เยียบเย็นดังก้องขึ้นจากด้านหลัง ไม่ใช่เสียงตามสายลม แต่เป็นคลื่นโทรจิตที่บีบอัดจนขมับของเขาปวดแปลบ เร็นหันกลับไปทันที ประตูมิติรอยแยกสีดำสนิทกำลังฉีกอากาศออกเป็นริ้วๆ ปรากฏร่างเงาในชุดเกราะทมิฬที่พร้อมจะช่วงชิงทุกสิ่งไปจากเขา</p>`;
    let legacyChars = [];
    let legacyLocs = [];
    let legacyTimes = [];
    let legacyChat = [];
    try {
      legacyChars = JSON.parse(
        localStorage.getItem("novel_characters") || "[]",
      );
    } catch {}
    try {
      legacyLocs = JSON.parse(localStorage.getItem("novel_locations") || "[]");
    } catch {}
    try {
      legacyTimes = JSON.parse(localStorage.getItem("novel_timelines") || "[]");
    } catch {}
    try {
      legacyChat = JSON.parse(
        localStorage.getItem("novel_chat_history") || "[]",
      );
    } catch {}

    const initialStory = StoryChatCore.createDefaultStory({
      id: "story-default",
      title: legacyTitle,
      content: legacyContent,
      characters: legacyChars.length > 0 ? legacyChars : undefined,
      locations: legacyLocs.length > 0 ? legacyLocs : undefined,
      timelines: legacyTimes.length > 0 ? legacyTimes : undefined,
      chatMessages: legacyChat,
    });
    rawStories = [initialStory];
    localStorage.setItem("novel_stories", JSON.stringify(rawStories));
    localStorage.setItem("novel_active_story_id", initialStory.id);
  }

  const savedActiveId = localStorage.getItem("novel_active_story_id");
  const initialActiveId = rawStories.find((s) => s.id === savedActiveId)
    ? savedActiveId
    : rawStories[0].id;

  const state = {
    stories: rawStories,
    activeStoryId: initialActiveId,
    apiKey: localStorage.getItem("gemini_api_key") || "",
    activeTab: "chat",
    activeStyle: "บรรยายเน้นอารมณ์",
    isAiResponding: false,
  };

  // ตัวแปรจำตำแหน่งเคอร์เซอร์ล่าสุดในหน้ากระดาษนิยาย
  let savedEditorRange = null;

  function getActiveStory() {
    return (
      state.stories.find((s) => s.id === state.activeStoryId) ||
      state.stories[0]
    );
  }

  function saveStories() {
    // 1. บันทึกลง IndexedDB (ไม่ติดโควต้า 5MB)
    if (typeof NovelStorage !== "undefined" && NovelStorage.saveAllStories) {
      NovelStorage.saveAllStories(state.stories);
    }

    // 2. สำรองลง LocalStorage อย่างปลอดภัย
    try {
      localStorage.setItem("novel_stories", JSON.stringify(state.stories));
    } catch (quotaErr) {
      console.warn(
        "[Storage] LocalStorage เต็ม (~5MB Quota) ข้อมูลถูกบันทึกลง IndexedDB ปลอดภัยแล้ว",
      );
    }
    try {
      localStorage.setItem("novel_active_story_id", state.activeStoryId);
    } catch {}

    // 3. ซิงก์ประวัติแชทขึ้น Supabase Cloud ผ่าน Backend API
    const active = getActiveStory();
    if (active && active.chatMessages && active.chatMessages.length > 0) {
      const lastMsg = active.chatMessages[active.chatMessages.length - 1];
      if (
        lastMsg &&
        !lastMsg._cloudSynced &&
        typeof NovelStorage !== "undefined"
      ) {
        NovelStorage.syncChatToCloud({
          story_id: active.id,
          role: lastMsg.role,
          user_message: lastMsg.user_message || lastMsg.content,
          thinking_logs: lastMsg.thinking || "",
          story_output: lastMsg.content || "",
          model_name: "gemini-3.8-flash",
        })
          .then((res) => {
            if (res?.success) lastMsg._cloudSynced = true;
          })
          .catch(() => {});
      }
    }
  }

  // ================= DOM Elements =================
  const docTitleInput = document.getElementById("doc-title-input");
  const canvasTitle = document.getElementById("canvas-title");
  const canvasBody = document.getElementById("canvas-body");
  const wordCountBadge = document.getElementById("word-count-badge");
  const charCountBadge = document.getElementById("char-count-badge");
  const saveStatusText = document.getElementById("save-status-text");

  const btnNewStory = document.getElementById("btn-new-story");
  const btnStoriesList = document.getElementById("btn-stories-list");
  const btnClearCanvas = document.getElementById("btn-clear-canvas");
  const btnModalAddStory = document.getElementById("btn-modal-add-story");
  const storiesListContainer = document.getElementById(
    "stories-list-container",
  );
  const btnConfirmAccept = document.getElementById("btn-confirm-accept");

  const leftSidebar = document.getElementById("left-sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const rightSidebar = document.getElementById("right-sidebar");
  const btnToggleLeft = document.getElementById("btn-toggle-left");
  const btnCloseLeft = document.getElementById("btn-close-left");
  const btnToggleRight = document.getElementById("btn-toggle-right");
  const btnCloseRight = document.getElementById("btn-close-right");

  const chatFeed = document.getElementById("chat-feed");
  const chatInput = document.getElementById("chat-input");
  const btnSendChat = document.getElementById("btn-send-chat");
  const btnAbortChat = document.getElementById("btn-abort-chat");
  const btnUpgrade =
    document.getElementById("btn-upgrade") ||
    document.querySelector(".btn-upgrade");
  const styleSelect = document.getElementById("style-select");
  const btnNewChat = document.getElementById("btn-new-chat");
  const floatingAiBar = document.getElementById("floating-ai-bar");

  let activeAbortController = null;

  function openSidebar() {
    leftSidebar.classList.remove("collapsed");
    sidebarOverlay.style.display = "block";
    sidebarOverlay.setAttribute("aria-hidden", "false");
  }

  function closeSidebar() {
    leftSidebar.classList.add("collapsed");
    sidebarOverlay.style.display = "none";
    sidebarOverlay.setAttribute("aria-hidden", "true");
  }

  // ================= Custom Confirm Dialog System =================
  let pendingConfirmAction = null;

  function showConfirmDialog({
    title,
    message,
    acceptText = "ยืนยัน",
    onAccept,
  }) {
    const titleEl = document.getElementById("confirm-title");
    const msgEl = document.getElementById("confirm-message");
    if (titleEl) titleEl.textContent = title || "⚠️ ยืนยันการดำเนินการ";
    if (msgEl) msgEl.textContent = message;
    if (btnConfirmAccept) btnConfirmAccept.textContent = acceptText;
    pendingConfirmAction = onAccept;
    window.openModal("modal-confirm-dialog");
  }

  // ================= Save Cursor Position Inside Editor =================
  function saveCurrentEditorSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (canvasBody && canvasBody.contains(range.commonAncestorContainer)) {
        savedEditorRange = range.cloneRange();
      }
    }
  }

  // ================= Auto Scroll for Editor Canvas =================
  function autoScrollCanvasIfNeeded() {
    const scrollContainer = document.querySelector(".editor-scroll-container");
    if (!scrollContainer) return;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && canvasBody.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();

      // หากตำแหน่งเคอร์เซอร์เข้าใกล้ขอบล่างของพื้นที่มองเห็นน้อยกว่า 140px ให้เลื่อน scroll ลงมาอัตโนมัติ
      const threshold = 140;
      if (rect.bottom > containerRect.bottom - threshold) {
        const offset = rect.bottom - (containerRect.bottom - threshold);
        scrollContainer.scrollBy({ top: offset, behavior: "smooth" });
      }
    }
  }

  // ================= Load Story Into Editor =================
  function loadStoryIntoEditor(story) {
    if (!story) return;
    docTitleInput.value = story.title;
    canvasTitle.value = story.title;
    canvasBody.innerHTML = story.content;
    savedEditorRange = null;

    updateCounts();
    renderNotes();
    renderChat();
  }

  function init() {
    const currentStory = getActiveStory();
    loadStoryIntoEditor(currentStory);
    setupEventListeners();
    checkBackendStatus();

    // โหลดข้อมูลล่าสุดจาก IndexedDB (ถ้ามีข้อมูลที่ใหญ่กว่าและใหม่กว่า)
    if (typeof NovelStorage !== "undefined" && NovelStorage.loadAllStories) {
      NovelStorage.loadAllStories()
        .then((loaded) => {
          if (Array.isArray(loaded) && loaded.length > 0) {
            state.stories = loaded;
            const story = getActiveStory();
            loadStoryIntoEditor(story);
          }
        })
        .catch(() => {});
    }
  }

  async function checkBackendStatus() {
    try {
      const backendUrl =
        window.location.port === "3001"
          ? "/api/health"
          : "http://localhost:3001/api/health";
      const res = await fetch(backendUrl);
      if (res.ok) {
        const data = await res.json();
        console.log("🟢 [Novel AI] เชื่อมต่อ Backend & Supabase สำเร็จ:", data);
        if (saveStatusText) {
          saveStatusText.textContent = "บันทึกแล้ว (คลาวด์พร้อม ☁️)";
        }
      }
    } catch (e) {
      console.log("ℹ️ [Novel AI] กำลังทำงานในโหมด Client Standalone / Offline");
    }
  }

  // ================= Event Listeners =================
  function setupEventListeners() {
    docTitleInput.addEventListener("input", (e) => {
      canvasTitle.value = e.target.value;
      triggerAutoSave();
    });

    canvasTitle.addEventListener("input", (e) => {
      docTitleInput.value = e.target.value;
      triggerAutoSave();
    });

    canvasBody.addEventListener("input", () => {
      saveCurrentEditorSelection();
      updateCounts();
      triggerAutoSave();
      autoScrollCanvasIfNeeded();
    });

    canvasBody.addEventListener("keyup", (e) => {
      saveCurrentEditorSelection();
      if (e.key === "Enter" || e.key === "ArrowDown") {
        autoScrollCanvasIfNeeded();
      }
    });
    canvasBody.addEventListener("mouseup", saveCurrentEditorSelection);

    if (btnToggleLeft)
      btnToggleLeft.addEventListener("click", () => {
        if (leftSidebar.classList.contains("collapsed")) {
          openSidebar();
        } else {
          closeSidebar();
        }
      });
    if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);
    if (btnCloseLeft) btnCloseLeft.addEventListener("click", closeSidebar);
    if (btnToggleRight)
      btnToggleRight.addEventListener("click", () =>
        rightSidebar.classList.toggle("collapsed"),
      );
    if (btnCloseRight)
      btnCloseRight.addEventListener("click", () =>
        rightSidebar.classList.add("collapsed"),
      );

    document.querySelectorAll("[data-command]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const cmd = btn.getAttribute("data-command");
        const val = btn.getAttribute("data-value") || null;
        executeFormatting(cmd, val);
      });
    });

    const blockSelect = document.getElementById("format-block-select");
    if (blockSelect) {
      blockSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        const tag = val.startsWith("<") ? val : `<${val}>`;
        executeFormatting("formatBlock", tag);
        canvasBody.focus();
      });
    }

    const btnSparkleAi = document.getElementById("btn-sparkle-ai");
    if (btnSparkleAi) {
      btnSparkleAi.addEventListener("click", () => {
        rightSidebar.classList.remove("collapsed");
        chatInput.value =
          "ช่วยจุดประกายไอเดียและแต่งเนื้อเรื่องฉากถัดไปต่อจากตอนล่าสุดให้หน่อยครับ";
        sendUserMessage();
      });
    }

    const btnInsertImg = document.getElementById("btn-insert-image");
    if (btnInsertImg) {
      btnInsertImg.addEventListener("click", () => {
        const url = prompt(
          "ใส่ลิงก์รูปภาพ (Image URL):",
          "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800",
        );
        if (url && url.trim()) {
          executeFormatting("insertImage", url.trim());
        }
      });
    }

    const btnInsertLink = document.getElementById("btn-insert-link");
    if (btnInsertLink) {
      btnInsertLink.addEventListener("click", () => {
        const url = prompt("ใส่ลิงก์ URL:", "https://");
        if (url && url.trim()) {
          executeFormatting("createLink", url.trim());
        }
      });
    }

    document.addEventListener("selectionchange", handleTextSelection);
    canvasBody.addEventListener("mouseup", handleTextSelection);
    canvasBody.addEventListener("keyup", handleTextSelection);

    const editorScrollContainer = document.querySelector(
      ".editor-scroll-container",
    );
    if (editorScrollContainer) {
      editorScrollContainer.addEventListener(
        "scroll",
        () => {
          if (floatingAiBar && floatingAiBar.style.display !== "none") {
            handleTextSelection();
          }
        },
        { passive: true },
      );
    }
    window.addEventListener(
      "resize",
      () => {
        if (floatingAiBar && floatingAiBar.style.display !== "none") {
          handleTextSelection();
        }
      },
      { passive: true },
    );

    if (floatingAiBar) {
      floatingAiBar.addEventListener("mousedown", (e) => {
        e.preventDefault();
      });
    }

    document.querySelectorAll(".floating-ai-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const action = btn.getAttribute("data-action");
        const selectionText =
          lastSelectedText || window.getSelection().toString().trim();
        if (selectionText) {
          handleAiActionOnSelection(action, selectionText);
          if (floatingAiBar) floatingAiBar.style.display = "none";
        }
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document
          .querySelectorAll(".modal-backdrop.active")
          .forEach((m) => m.classList.remove("active"));
        if (floatingAiBar) floatingAiBar.style.display = "none";
      }
    });

    if (btnNewStory)
      btnNewStory.addEventListener("click", handleCreateNewStory);

    if (btnModalAddStory) {
      btnModalAddStory.addEventListener("click", () => {
        closeModal("modal-stories-list");
        handleCreateNewStory();
      });
    }

    if (btnStoriesList) {
      btnStoriesList.addEventListener("click", () => {
        renderStoriesList();
        openModal("modal-stories-list");
      });
    }

    if (btnClearCanvas) {
      btnClearCanvas.addEventListener("click", () => {
        showConfirmDialog({
          title: "ล้างเนื้อหากระดาษ",
          message:
            "คุณต้องการล้างเนื้อหานิยายในหน้านี้ทั้งหมดใช่หรือไม่? (การกระทำนี้ไม่สามารถย้อนกลับได้)",
          acceptText: "ยืนยันล้างกระดาษ",
          onAccept: () => {
            canvasBody.innerHTML = StoryChatCore.clearCanvasContent();
            savedEditorRange = null;
            const currentStory = getActiveStory();
            currentStory.content = canvasBody.innerHTML;
            currentStory.updatedAt = Date.now();
            saveStories();
            updateCounts();
            showToast("ล้างเนื้อหากระดาษเรียบร้อยแล้ว ✨");
          },
        });
      });
    }

    if (btnConfirmAccept) {
      btnConfirmAccept.addEventListener("click", () => {
        if (typeof pendingConfirmAction === "function") {
          const action = pendingConfirmAction;
          pendingConfirmAction = null;
          closeModal("modal-confirm-dialog");
          action();
        } else {
          closeModal("modal-confirm-dialog");
        }
      });
    }

    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendUserMessage();
      }
    });

    btnSendChat.addEventListener("click", () => sendUserMessage());

    if (btnAbortChat) {
      btnAbortChat.addEventListener("click", () => {
        if (activeAbortController) {
          activeAbortController.abort();
          showToast("หยุดการสร้างข้อความแล้ว ⏹️");
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.isAiResponding && activeAbortController) {
        activeAbortController.abort();
        showToast("ยกเลิกการสร้างข้อความแล้ว ⏹️");
      }
    });

    if (btnUpgrade) {
      btnUpgrade.addEventListener("click", () => {
        openModal("modal-upgrade");
      });
    }

    const btnActivatePro = document.getElementById("btn-activate-pro-preview");
    if (btnActivatePro) {
      btnActivatePro.addEventListener("click", () => {
        state.isPro = true;
        closeModal("modal-upgrade");
        if (btnUpgrade) {
          btnUpgrade.innerHTML = `⭐ PRO ACTIVE`;
          btnUpgrade.style.background =
            "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)";
        }
        showToast(
          "🌟 ปลดล็อกสิทธิ์ Pro Preview เรียบร้อยแล้ว! ใช้งาน Gemini 3.8 Flash และระบบคิดสดเต็มรูปแบบ ✨",
        );
      });
    }

    if (btnNewChat) {
      btnNewChat.addEventListener("click", () => {
        showConfirmDialog({
          title: "เริ่มแชทใหม่",
          message:
            "คุณต้องการล้างประวัติการสนทนาทั้งหมดในเซสชันนี้และเริ่มแชทใหม่หรือไม่?",
          acceptText: "ยืนยันเริ่มแชทใหม่",
          onAccept: () => {
            const currentStory = getActiveStory();
            currentStory.chatMessages = [];
            currentStory.updatedAt = Date.now();
            saveStories();
            chatInput.value = "";
            renderChat();
            showToast("เริ่มเซสชันแชทใหม่เรียบร้อยแล้ว ✨");
          },
        });
      });
    }

    document.querySelectorAll(".quick-action-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const promptText = btn.getAttribute("data-prompt");
        if (promptText) {
          chatInput.value = promptText;
          sendUserMessage();
        }
      });
    });

    if (styleSelect) {
      styleSelect.addEventListener("change", (e) => {
        state.activeStyle = e.target.value;
        showToast(`เลือกสไตล์: ${state.activeStyle}`);
      });
    }

    document.querySelectorAll(".chat-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".chat-tab-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeTab = btn.getAttribute("data-tab");
        handleTabChange(state.activeTab);
      });
    });

    document.querySelectorAll(".note-item-header").forEach((header) => {
      header.addEventListener("click", () => {
        const item = header.closest(".note-item");
        item.classList.toggle("open");
      });
    });

    const btnAddChar = document.getElementById("btn-add-character");
    if (btnAddChar) {
      btnAddChar.addEventListener("click", (e) => {
        e.stopPropagation();
        openModal("modal-add-character");
      });
    }

    const btnAddLoc = document.getElementById("btn-add-location");
    if (btnAddLoc) {
      btnAddLoc.addEventListener("click", (e) => {
        e.stopPropagation();
        openModal("modal-add-location");
      });
    }

    const btnAddTimeline = document.getElementById("btn-add-timeline");
    if (btnAddTimeline) {
      btnAddTimeline.addEventListener("click", (e) => {
        e.stopPropagation();
        openModal("modal-add-timeline");
      });
    }

    const btnAddOverview = document.getElementById("btn-add-overview");
    if (btnAddOverview) {
      btnAddOverview.addEventListener("click", (e) => {
        e.stopPropagation();
        openModal("modal-add-overview");
      });
    }

    const formAddOverview = document.getElementById("form-add-overview");
    if (formAddOverview) {
      formAddOverview.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = document.getElementById("overview-title").value.trim();
        const desc = document.getElementById("overview-desc").value.trim();
        if (title && desc) {
          const currentStory = getActiveStory();
          if (!currentStory.overview) currentStory.overview = [];
          currentStory.overview.push({ id: "o-" + Date.now(), title, desc });
          currentStory.updatedAt = Date.now();
          saveStories();
          renderNotes();
          closeModal("modal-add-overview");
          formAddOverview.reset();
          showToast(`เพิ่มภาพรวม "${title}" สำเร็จ`);
        }
      });
    }

    const formAddChar = document.getElementById("form-add-character");
    if (formAddChar) {
      formAddChar.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("char-name").value.trim();
        const role = document.getElementById("char-role").value.trim();
        const desc = document.getElementById("char-desc").value.trim();
        if (name) {
          const currentStory = getActiveStory();
          if (!currentStory.characters) currentStory.characters = [];
          currentStory.characters.push({
            id: Date.now().toString(),
            name,
            role,
            desc,
          });
          currentStory.updatedAt = Date.now();
          saveStories();
          renderNotes();
          closeModal("modal-add-character");
          formAddChar.reset();
          showToast(`เพิ่มตัวละคร "${name}" สำเร็จ`);
        }
      });
    }

    const formAddLoc = document.getElementById("form-add-location");
    if (formAddLoc) {
      formAddLoc.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("loc-name").value.trim();
        const type = document.getElementById("loc-type").value.trim();
        const desc = document.getElementById("loc-desc").value.trim();
        if (name) {
          const currentStory = getActiveStory();
          if (!currentStory.locations) currentStory.locations = [];
          currentStory.locations.push({
            id: Date.now().toString(),
            name,
            type,
            desc,
          });
          currentStory.updatedAt = Date.now();
          saveStories();
          renderNotes();
          closeModal("modal-add-location");
          formAddLoc.reset();
          showToast(`เพิ่มสถานที่ "${name}" สำเร็จ`);
        }
      });
    }

    const formAddTimeline = document.getElementById("form-add-timeline");
    if (formAddTimeline) {
      formAddTimeline.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = document.getElementById("timeline-title").value.trim();
        const time = document.getElementById("timeline-time").value.trim();
        const desc = document.getElementById("timeline-desc").value.trim();
        if (title) {
          const currentStory = getActiveStory();
          if (!currentStory.timelines) currentStory.timelines = [];
          currentStory.timelines.push({
            id: Date.now().toString(),
            title,
            time,
            desc,
          });
          currentStory.updatedAt = Date.now();
          saveStories();
          renderNotes();
          closeModal("modal-add-timeline");
          formAddTimeline.reset();
          showToast(`เพิ่มช่วงเวลา "${title}" สำเร็จ`);
        }
      });
    }

    const btnSettings = document.getElementById("btn-settings");
    if (btnSettings) {
      btnSettings.addEventListener("click", () => {
        document.getElementById("input-gemini-key").value = state.apiKey;
        openModal("modal-settings");
      });
    }

    const formSettings = document.getElementById("form-settings");
    if (formSettings) {
      formSettings.addEventListener("submit", (e) => {
        e.preventDefault();
        state.apiKey = document.getElementById("input-gemini-key").value.trim();
        localStorage.setItem("gemini_api_key", state.apiKey);
        closeModal("modal-settings");
        showToast(
          state.apiKey
            ? "เชื่อมต่อ Gemini API Key เรียบร้อย ✨"
            : "สลับเป็นโหมดจำลอง AI ออฟไลน์",
        );
      });
    }

    const btnExport = document.getElementById("btn-export");
    if (btnExport) {
      btnExport.addEventListener("click", () => {
        openModal("modal-export");
      });
    }

    const getCurrentDocTitle = () =>
      (getActiveStory()?.title || docTitleInput.value || "นิยายของฉัน").trim();

    const getSafeFilename = (ext) => {
      const clean = getCurrentDocTitle()
        .replace(/[/\\?%*:|"<>]/g, "_")
        .trim();
      return `${clean || "novel"}.${ext}`;
    };

    const btnExportTxt = document.getElementById("btn-export-txt");
    if (btnExportTxt)
      btnExportTxt.addEventListener("click", () =>
        downloadFile(getSafeFilename("txt"), canvasBody.innerText),
      );

    const btnExportMd = document.getElementById("btn-export-md");
    if (btnExportMd)
      btnExportMd.addEventListener("click", () =>
        downloadFile(
          getSafeFilename("md"),
          `# ${getCurrentDocTitle()}\n\n` +
            htmlToMarkdown(canvasBody.innerHTML),
        ),
      );

    const btnExportHtml = document.getElementById("btn-export-html");
    if (btnExportHtml)
      btnExportHtml.addEventListener("click", () => {
        const safeTitle = escapeHtml(getCurrentDocTitle());
        downloadFile(
          getSafeFilename("html"),
          `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeTitle}</title></head><body><h1>${safeTitle}</h1>${canvasBody.innerHTML}</body></html>`,
        );
      });

    const btnShare = document.getElementById("btn-share");
    if (btnShare) {
      btnShare.addEventListener("click", () => {
        openModal("modal-share");
      });
    }

    const btnShareCanvas = document.getElementById("btn-share-copy-canvas");
    if (btnShareCanvas) {
      btnShareCanvas.addEventListener("click", () => {
        const title = getCurrentDocTitle();
        const text = canvasBody.innerText || "";
        const fullContent = `${title}\n\n${text}`.trim();
        navigator.clipboard
          .writeText(fullContent)
          .then(() => {
            closeModal("modal-share");
            showToast(
              "คัดลอกเนื้อหานิยายทั้งหมดลงคลิปบอร์ดแล้ว พร้อมนำไปวางในเว็บนิยาย 📋✨",
            );
          })
          .catch(() => showToast("คัดลอกไม่สำเร็จ"));
      });
    }

    const btnShareSynopsis = document.getElementById("btn-share-copy-synopsis");
    if (btnShareSynopsis) {
      btnShareSynopsis.addEventListener("click", () => {
        const story = getActiveStory();
        const chars = (story.characters || [])
          .map((c) => `- ${c.name} (${c.role || "ทั่วไป"}): ${c.desc || ""}`)
          .join("\n");
        const locs = (story.locations || [])
          .map((l) => `- ${l.name} (${l.type || "สถานที่"}): ${l.desc || ""}`)
          .join("\n");
        const overview = (story.overview || [])
          .map((o) => `[${o.title}]: ${o.desc || ""}`)
          .join("\n");
        const synopsis = [
          `📖 ชื่อเรื่อง: ${story.title}`,
          overview ? `\n📌 ภาพรวมโครงเรื่อง:\n${overview}` : "",
          chars ? `\n👥 ตัวละครสำคัญ:\n${chars}` : "",
          locs ? `\n🗺️ สถานที่สำคัญ:\n${locs}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        navigator.clipboard
          .writeText(synopsis)
          .then(() => {
            closeModal("modal-share");
            showToast("คัดลอกข้อมูลสรุปโครงเรื่องและ Lorebook แล้ว 📝✨");
          })
          .catch(() => showToast("คัดลอกไม่สำเร็จ"));
      });
    }

    const btnShareLink = document.getElementById("btn-share-copy-link");
    if (btnShareLink) {
      btnShareLink.addEventListener("click", () => {
        navigator.clipboard
          .writeText(window.location.href)
          .then(() => {
            closeModal("modal-share");
            showToast("คัดลอกลิงก์โครงการสตูดิโอแล้ว 🔗");
          })
          .catch(() => showToast("คัดลอกไม่สำเร็จ"));
      });
    }
  }

  // ================= Formatting Helper =================
  function executeFormatting(command, value = null) {
    canvasBody.focus();
    document.execCommand(command, false, value);
    canvasBody.focus();
    saveCurrentEditorSelection();
    updateCounts();
    triggerAutoSave();
  }

  // ================= Word & Character Count =================
  function updateCounts() {
    const text = canvasBody.innerText || "";
    const cleanText = text.trim();
    const charCount = cleanText.replace(/\s+/g, "").length;

    let words = 0;
    if (cleanText) {
      if (typeof Intl !== "undefined" && Intl.Segmenter) {
        try {
          const segmenter = new Intl.Segmenter("th", { granularity: "word" });
          const segments = segmenter.segment(cleanText);
          for (const seg of segments) {
            if (seg.isWordLike) words++;
          }
        } catch {
          words = cleanText.split(/\s+/).filter(Boolean).length;
        }
      } else {
        words = cleanText.split(/\s+/).filter(Boolean).length;
      }
    }

    if (charCountBadge)
      charCountBadge.textContent = `${charCount.toLocaleString()} ตัวอักษร`;
    if (wordCountBadge)
      wordCountBadge.textContent = `${words.toLocaleString()} คำ`;
  }

  // ================= Auto Save =================
  let autoSaveTimeout;
  function triggerAutoSave() {
    if (saveStatusText) saveStatusText.textContent = "กำลังบันทึก...";
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      const currentStory = getActiveStory();
      currentStory.title = docTitleInput.value.trim() || "นิยายไม่มีชื่อ";
      currentStory.content = canvasBody.innerHTML;
      currentStory.updatedAt = Date.now();
      saveStories();
      if (saveStatusText) saveStatusText.textContent = "บันทึกแล้ว";
    }, 500);
  }

  // ================= Floating AI Bar on Selection =================
  let lastSelectedText = "";

  function handleTextSelection() {
    if (!floatingAiBar) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      floatingAiBar.style.display = "none";
      return;
    }

    const range = selection.getRangeAt(0);
    if (!canvasBody.contains(range.commonAncestorContainer)) {
      floatingAiBar.style.display = "none";
      return;
    }

    // บันทึก Range ล่าสุดไว้เผื่อกดแทรกข้อความ
    savedEditorRange = range.cloneRange();

    const selectedStr = selection.toString().trim();
    if (!selectedStr) {
      floatingAiBar.style.display = "none";
      return;
    }
    lastSelectedText = selectedStr;

    const rect = range.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      floatingAiBar.style.display = "none";
      return;
    }

    const scrollContainer = document.querySelector(".editor-scroll-container");
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      if (rect.bottom < containerRect.top || rect.top > containerRect.bottom) {
        floatingAiBar.style.display = "none";
        return;
      }
    }

    floatingAiBar.style.display = "flex";
    const barHeight = floatingAiBar.offsetHeight || 38;
    const barWidth = floatingAiBar.offsetWidth || 340;

    const gap = 8;
    const toolbar = document.querySelector(".editor-toolbar");
    const toolbarBottom = toolbar ? toolbar.getBoundingClientRect().bottom : 96;

    let targetTop;
    const isNearTopEdge =
      rect.top < 60 || rect.top - barHeight - gap < toolbarBottom;

    if (isNearTopEdge) {
      targetTop = rect.bottom + gap;
    } else {
      targetTop = rect.top - barHeight - gap;
    }

    if (targetTop + barHeight > window.innerHeight - 8) {
      targetTop = Math.max(
        toolbarBottom + 4,
        window.innerHeight - barHeight - 8,
      );
    }

    let targetLeft = rect.left + rect.width / 2 - barWidth / 2;
    const minLeft = 12;
    const maxLeft = window.innerWidth - barWidth - 12;
    targetLeft = Math.max(minLeft, Math.min(targetLeft, maxLeft));

    floatingAiBar.style.top = `${Math.round(targetTop)}px`;
    floatingAiBar.style.left = `${Math.round(targetLeft)}px`;
  }

  function handleAiActionOnSelection(action, text) {
    rightSidebar.classList.remove("collapsed");

    const chatTabBtn = document.querySelector('.chat-tab-btn[data-tab="chat"]');
    if (chatTabBtn && !chatTabBtn.classList.contains("active")) {
      document
        .querySelectorAll(".chat-tab-btn")
        .forEach((b) => b.classList.remove("active"));
      chatTabBtn.classList.add("active");
      state.activeTab = "chat";
    }

    let prompt = "";
    if (action === "polish") {
      prompt = `ช่วยเกลาสำนวนและคำบรรยายของข้อความนี้ให้ไพเราะและเห็นภาพชัดเจนขึ้นในสไตล์ ${state.activeStyle}:\n\n"${text}"`;
    } else if (action === "continue") {
      prompt = `ช่วยแต่งเนื้อเรื่องและบทบรรยายต่อจากข้อความนี้อย่างน่าติดตาม ในสไตล์ ${state.activeStyle}:\n\n"${text}"`;
    } else if (action === "dialogue") {
      prompt = `ช่วยเขียนบทสนทนาและท่าทางตัวละครที่เข้มข้นขยายความจากฉากนี้:\n\n"${text}"`;
    } else if (action === "summarize") {
      prompt = `ช่วยวิเคราะห์และสรุปใจความสำคัญของท่อนนี้:\n\n"${text}"`;
    }
    chatInput.value = prompt;
    sendUserMessage();
  }

  // ================= Notes Rendering =================
  function renderNotes() {
    const currentStory = getActiveStory();

    const overviewBadge = document.getElementById("badge-overview");
    if (overviewBadge)
      overviewBadge.textContent = (currentStory.overview || []).length;

    const overviewList = document.getElementById("list-overview");
    if (overviewList) {
      overviewList.innerHTML = (currentStory.overview || [])
        .map(
          (o) => `
        <div class="sub-card" data-overview-id="${o.id}">
          <button class="btn-card-del" data-del-type="overview" data-id="${o.id}" title="ลบหัวข้อภาพรวม">✕</button>
          <div class="sub-card-title">${escapeHtml(o.title)}</div>
          <div class="sub-card-desc">${escapeHtml(o.desc || "")}</div>
        </div>
      `,
        )
        .join("");

      overviewList.querySelectorAll(".sub-card").forEach((card) => {
        card.addEventListener("click", () => {
          const oId = card.getAttribute("data-overview-id");
          const o = (currentStory.overview || []).find(
            (item) => item.id === oId,
          );
          if (o) {
            chatInput.value = `ขอไอเดียการดำเนินเรื่องที่สอดคล้องกับ "${o.title}" (${o.desc}) ในฉากถัดไปหน่อยครับ`;
            rightSidebar.classList.remove("collapsed");
            chatInput.focus();
          }
        });
      });

      overviewList.querySelectorAll(".btn-card-del").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          currentStory.overview = StoryChatCore.deleteNoteItem(
            currentStory.overview,
            id,
          );
          currentStory.updatedAt = Date.now();
          saveStories();
          renderNotes();
          showToast("ลบหัวข้อภาพรวมแล้ว");
        });
      });
    }

    const charBadge = document.getElementById("badge-characters");
    if (charBadge)
      charBadge.textContent = (currentStory.characters || []).length;

    const charList = document.getElementById("list-characters");
    if (charList) {
      charList.innerHTML = (currentStory.characters || [])
        .map(
          (c) => `
        <div class="sub-card" data-char-id="${c.id}">
          <button class="btn-card-del" data-del-type="character" data-id="${c.id}" title="ลบตัวละคร">✕</button>
          <div class="sub-card-title">${escapeHtml(c.name)} <span style="font-size: 10px; color: var(--accent-blue); font-weight: normal;">• ${escapeHtml(c.role || "")}</span></div>
          <div class="sub-card-desc">${escapeHtml(c.desc || "")}</div>
        </div>
      `,
        )
        .join("");

      charList.querySelectorAll(".sub-card").forEach((card) => {
        card.addEventListener("click", () => {
          const charId = card.getAttribute("data-char-id");
          const char = (currentStory.characters || []).find(
            (c) => c.id === charId,
          );
          if (char) {
            chatInput.value = `ช่วยแต่งฉากหรือบทสนทนาของตัวละคร "${char.name}" (${char.role}: ${char.desc}) ต่อจากเนื้อเรื่องปัจจุบันหน่อยครับ`;
            rightSidebar.classList.remove("collapsed");
            chatInput.focus();
          }
        });
      });

      charList.querySelectorAll(".btn-card-del").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          currentStory.characters = StoryChatCore.deleteNoteItem(
            currentStory.characters,
            id,
          );
          currentStory.updatedAt = Date.now();
          saveStories();
          renderNotes();
          showToast("ลบข้อมูลตัวละครแล้ว");
        });
      });
    }

    const locBadge = document.getElementById("badge-locations");
    if (locBadge) locBadge.textContent = (currentStory.locations || []).length;

    const locList = document.getElementById("list-locations");
    if (locList) {
      locList.innerHTML = (currentStory.locations || [])
        .map(
          (l) => `
        <div class="sub-card" data-loc-id="${l.id}">
          <button class="btn-card-del" data-del-type="location" data-id="${l.id}" title="ลบสถานที่">✕</button>
          <div class="sub-card-title">${escapeHtml(l.name)} <span style="font-size: 10px; color: var(--accent-cyan); font-weight: normal;">• ${escapeHtml(l.type || "")}</span></div>
          <div class="sub-card-desc">${escapeHtml(l.desc || "")}</div>
        </div>
      `,
        )
        .join("");

      locList.querySelectorAll(".sub-card").forEach((card) => {
        card.addEventListener("click", () => {
          const locId = card.getAttribute("data-loc-id");
          const loc = (currentStory.locations || []).find(
            (l) => l.id === locId,
          );
          if (loc) {
            chatInput.value = `ช่วยเขียนบทบรรยายฉากและบรรยากาศของสถานที่ "${loc.name}" (${loc.type}: ${loc.desc}) เพื่อใช้ในฉากนี้หน่อยครับ`;
            rightSidebar.classList.remove("collapsed");
            chatInput.focus();
          }
        });
      });

      locList.querySelectorAll(".btn-card-del").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          currentStory.locations = StoryChatCore.deleteNoteItem(
            currentStory.locations,
            id,
          );
          currentStory.updatedAt = Date.now();
          saveStories();
          renderNotes();
          showToast("ลบข้อมูลสถานที่แล้ว");
        });
      });
    }

    const timeBadge = document.getElementById("badge-timelines");
    if (timeBadge)
      timeBadge.textContent = (currentStory.timelines || []).length;

    const timeList = document.getElementById("list-timelines");
    if (timeList) {
      timeList.innerHTML = (currentStory.timelines || [])
        .map(
          (t) => `
        <div class="sub-card" data-time-id="${t.id}">
          <button class="btn-card-del" data-del-type="timeline" data-id="${t.id}" title="ลบช่วงเวลา">✕</button>
          <div class="sub-card-title">${escapeHtml(t.title)} <span style="font-size: 10px; color: var(--accent-gold); font-weight: normal;">• ${escapeHtml(t.time || "")}</span></div>
          <div class="sub-card-desc">${escapeHtml(t.desc || "")}</div>
        </div>
      `,
        )
        .join("");

      timeList.querySelectorAll(".sub-card").forEach((card) => {
        card.addEventListener("click", () => {
          const timeId = card.getAttribute("data-time-id");
          const t = (currentStory.timelines || []).find(
            (item) => item.id === timeId,
          );
          if (t) {
            chatInput.value = `ช่วยแต่งเนื้อเรื่องเชื่อมโยงกับเหตุการณ์ "${t.title}" (${t.time}: ${t.desc}) หน่อยครับ`;
            rightSidebar.classList.remove("collapsed");
            chatInput.focus();
          }
        });
      });

      timeList.querySelectorAll(".btn-card-del").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-id");
          currentStory.timelines = StoryChatCore.deleteNoteItem(
            currentStory.timelines,
            id,
          );
          currentStory.updatedAt = Date.now();
          saveStories();
          renderNotes();
          showToast("ลบข้อมูลช่วงเวลาแล้ว");
        });
      });
    }
  }

  // ================= AI Chat & Assistant Logic =================
  function renderChat() {
    if (!chatFeed) return;

    const currentStory = getActiveStory();
    if (!currentStory.chatMessages) currentStory.chatMessages = [];

    const welcomeCard = document.getElementById("chat-welcome-card");
    if (welcomeCard) {
      welcomeCard.style.display =
        currentStory.chatMessages.length === 0 ? "flex" : "none";
    }

    const existingMsgs = chatFeed.querySelectorAll(".chat-msg");
    existingMsgs.forEach((m) => m.remove());

    currentStory.chatMessages.forEach((msg, idx) => {
      const msgEl = createMessageElement(msg, idx);
      chatFeed.appendChild(msgEl);
    });

    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  // ================= ThoughtLine Component (from React Bits) =================
  const HUGEICONS = {
    sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2l1.5 4.5L20 8l-4.5 1.5L14 14l-1.5-4.5L8 8l4.5-1.5L14 2z"/><path d="M6 16l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/></svg>`,
    tick: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>`,
    arrowDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9l-6 6-6-6"/></svg>`,
  };

  function parseThinkingSteps(thinkingText, isWorking = false) {
    if (
      typeof StoryChatCore !== "undefined" &&
      StoryChatCore.parseThinkingSteps
    ) {
      return StoryChatCore.parseThinkingSteps(thinkingText, isWorking);
    }
    if (!thinkingText) {
      return isWorking
        ? [
            "วิเคราะห์บริบทนิยายและคำสั่งนักเขียน",
            "ค้นหาข้อมูลตัวละครและสถานที่ใน Lorebook",
            "รังสรรค์สำนวนวรรณศิลป์ตามขั้นตอนความคิด",
          ]
        : ["วิเคราะห์โครงเรื่องและคำสั่งนักเขียน"];
    }
    return [thinkingText.trim()];
  }

  // ฟอร์แมตเนื้อหา Reasoning / Thinking ให้รองรับทั้งแบบย่อหน้าคำบรรยายและขั้นตอน (Steps)
  function formatReasoningContent(rawText, steps = [], isWorking = false) {
    const cleanText = (rawText || "")
      .replace(/^\[Gemini ThinkingConfig:[^\]]*\]/gi, "")
      .replace(/<\/?think(ing)?>/gi, "")
      .trim();

    if (!cleanText && steps.length === 0) {
      return isWorking
        ? `<div class="thought-line__reasoning-paragraph" style="color: #94a3b8; font-style: italic;">กำลังวิเคราะห์บริบทและเตรียมโครงเรื่อง...<span class="thought-line__streaming-cursor"></span></div>`
        : "";
    }

    const paragraphs = cleanText
      ? cleanText.split(/\n\n+/).filter(Boolean)
      : [];

    // หากข้อความยาวหรือถูกแบ่งเป็นย่อหน้า (สไตล์ UChatReasoning)
    if (
      paragraphs.length > 1 ||
      (paragraphs.length === 1 && paragraphs[0].length > 90)
    ) {
      const contentHtml = paragraphs
        .map((p, idx) => {
          const isLast = idx === paragraphs.length - 1;
          const escaped = escapeHtml(p.trim()).replace(/\n/g, "<br>");
          return `<p class="thought-line__reasoning-paragraph">${escaped}${isWorking && isLast ? '<span class="thought-line__streaming-cursor"></span>' : ""}</p>`;
        })
        .join("");
      return `<div class="thought-line__reasoning-content">${contentHtml}</div>`;
    }

    // กรณีเป็นขั้นตอนกระบวนการคิด (Steps)
    const effectiveSteps =
      steps.length > 0 ? steps : cleanText ? [cleanText] : [];
    return `
      <div class="thought-line__steps">
        ${effectiveSteps
          .map((text, i) => {
            const stepDone = !isWorking || i < effectiveSteps.length - 1;
            const isLast = i === effectiveSteps.length - 1;
            return `
              <div class="thought-line__step" ${stepDone ? 'data-done=""' : ""}>
                <span class="thought-line__mark" aria-hidden="true">
                  ${stepDone ? HUGEICONS.tick : '<i class="thought-line__pulse"></i>'}
                </span>
                <span class="thought-line__step-text">${escapeHtml(text)}${isWorking && isLast ? '<span class="thought-line__streaming-cursor"></span>' : ""}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderThoughtLineHtml({
    working = false,
    label = "Thinking…",
    doneLabel = "Thought for",
    rawText = "",
    steps = [],
    durationSec = "0.0s",
    collapsible = true,
    open = false,
  }) {
    const hasTrace =
      steps.length > 0 || (rawText && rawText.trim().length > 0) || working;
    const isWorking = !!working;
    const isTraceOpen = isWorking ? true : open;
    const toggle = hasTrace && collapsible;

    const headInner = `
      <span class="thought-line__glyph" aria-hidden="true">
        ${HUGEICONS.sparkles}
      </span>
      <span class="thought-line__label" aria-hidden="true">
        <span class="thought-line__text" ${isWorking ? 'data-active=""' : ""}>
          <span class="thought-line__breath" ${isWorking ? 'data-shimmer=""' : ""}>
            ${escapeHtml(label)}
          </span>
        </span>
        <span class="thought-line__text thought-line__text--done" ${!isWorking ? 'data-active=""' : ""}>
          ${escapeHtml(doneLabel)}
        </span>
      </span>
      <span class="thought-line__timer" ${!isWorking ? 'data-done=""' : ""} aria-hidden="true">
        ${escapeHtml(durationSec)}
      </span>
      ${
        collapsible
          ? `<span class="thought-line__chevron" ${hasTrace ? 'data-on=""' : ""} aria-hidden="true">
              ${HUGEICONS.arrowDown}
            </span>`
          : ""
      }
      <span class="thought-line__sr" role="status">
        ${isWorking ? label : `${doneLabel} ${durationSec}`}
      </span>
    `;

    const bodyInnerHtml = formatReasoningContent(rawText, steps, isWorking);

    // Auto-Scroll Container พร้อม CSS Fade Mask
    const traceHtml = hasTrace
      ? `
        <div class="thought-line__trace" ${isTraceOpen ? 'data-open=""' : ""} aria-hidden="${!isTraceOpen}">
          <div class="thought-line__fold">
            <div class="thought-line__scroll-container">
              ${bodyInnerHtml}
            </div>
          </div>
        </div>
      `
      : "";

    return `
      <div class="thought-line" ${isWorking ? 'data-working=""' : ""} ${isTraceOpen ? 'data-open=""' : ""}>
        ${
          collapsible
            ? `<button type="button" class="thought-line__head" ${toggle ? 'data-toggle=""' : ""} aria-expanded="${isTraceOpen}" tabindex="${toggle ? "0" : "-1"}">
                ${headInner}
              </button>`
            : `<div class="thought-line__head">${headInner}</div>`
        }
        ${traceHtml}
      </div>
    `;
  }

  function createMessageElement(msg, index) {
    const el = document.createElement("div");
    el.className = `chat-msg ${msg.role}`;

    let thinkingHtml = "";
    if (msg.role === "ai" && (msg.thinking || msg.isThinking)) {
      const steps = parseThinkingSteps(msg.thinking, msg.isThinking);
      const durationText =
        msg.thinkingDuration || (msg.isThinking ? "0.0s" : "1.4s");
      thinkingHtml = renderThoughtLineHtml({
        working: !!msg.isThinking,
        label: "Thinking…",
        doneLabel: "Thought for",
        rawText: msg.thinking || "",
        steps,
        durationSec: durationText,
        collapsible: true,
        open: !!msg.thoughtOpen,
      });
    }

    let actionsHtml = "";
    if (msg.role === "ai" && !msg.isThinking) {
      const autoSavedBadgeHtml = msg.autoSavedToCanvas
        ? `<span class="msg-canvas-synced-badge" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #10b981; padding: 3px 8px; background: rgba(16,185,129,0.12); border-radius: 4px; font-weight: 500;">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 8.5l3.5 3.5 6.5-7"/></svg>
            อัปเดตหน้ากระดาษแล้ว
          </span>`
        : "";
      const copyActionHtml = msg.autoSavedToCanvas
        ? ""
        : `<button class="msg-action-btn" data-action="copy" data-index="${index}" title="คัดลอกข้อความ">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11V3h8"/></svg>
            คัดลอก
          </button>`;

      actionsHtml = `
        <div class="msg-actions">
          ${autoSavedBadgeHtml}
          <button class="msg-action-btn regen-btn" data-action="regenerate" data-index="${index}" title="สร้างคำตอบนี้ใหม่ (Regenerate)">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 8A6 6 0 1 1 8 2c2.4 0 4.5 1.4 5.5 3.5M14 2v4h-4"/>
            </svg>
            สร้างใหม่
          </button>
          ${copyActionHtml}
        </div>
      `;
    } else if (msg.role === "user") {
      actionsHtml = `
        <div class="user-msg-actions">
          <button class="user-action-btn edit-btn" data-action="edit" data-index="${index}" title="แก้ไขคำสั่งนี้" aria-label="แก้ไขคำสั่งนี้">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M11 2a2 2 0 0 1 2.8 2.8L5 13.6 2 14l.4-3L11 2z"/>
            </svg>
            แก้ไข
          </button>
        </div>
      `;
    }

    el.innerHTML = `
      ${!msg.isThinking ? `<button class="msg-del-btn" data-del-idx="${index}" title="ลบข้อความนี้">✕</button>` : ""}
      ${thinkingHtml}
      ${
        !msg.isThinking && !(msg.role === "ai" && msg.autoSavedToCanvas)
          ? `<div class="msg-bubble">${formatAiResponseText(msg.content)}</div>`
          : ""
      }
      ${actionsHtml}
    `;

    // Event สำหรับ toggle กาง/พับ ThoughtLine Trace
    const thoughtLineHead = el.querySelector(
      ".thought-line__head[data-toggle]",
    );
    if (thoughtLineHead) {
      thoughtLineHead.addEventListener("click", () => {
        const root = thoughtLineHead.closest(".thought-line");
        const trace = root?.querySelector(".thought-line__trace");
        const isOpen = root?.hasAttribute("data-open");
        if (isOpen) {
          root?.removeAttribute("data-open");
          trace?.removeAttribute("data-open");
          thoughtLineHead.setAttribute("aria-expanded", "false");
          msg.thoughtOpen = false;
        } else {
          root?.setAttribute("data-open", "");
          trace?.setAttribute("data-open", "");
          thoughtLineHead.setAttribute("aria-expanded", "true");
          msg.thoughtOpen = true;
        }
      });
    }

    const btnDelMsg = el.querySelector(".msg-del-btn");
    if (btnDelMsg) {
      btnDelMsg.addEventListener("click", (e) => {
        e.stopPropagation();
        const delIdx = parseInt(btnDelMsg.getAttribute("data-del-idx"), 10);
        const story = getActiveStory();
        story.chatMessages = StoryChatCore.deleteChatMessage(
          story.chatMessages,
          delIdx,
        );
        story.updatedAt = Date.now();
        saveStories();
        renderChat();
        showToast("ลบข้อความแชทแล้ว");
      });
    }

    el.querySelectorAll(".msg-action-btn, .user-action-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        if (action === "copy") {
          const pureStoryText = StoryChatCore.extractPureStoryContent(
            msg.content,
          );
          navigator.clipboard
            .writeText(pureStoryText)
            .then(() => showToast("คัดลอกเนื้อหาแล้ว"));
        } else if (action === "regenerate") {
          if (state.isAiResponding) return;
          const currentStory = getActiveStory();
          const prep = StoryChatCore.prepareRegenerateChat(
            currentStory.chatMessages,
          );
          if (prep.lastUserPrompt) {
            currentStory.chatMessages = prep.updatedMessages;
            currentStory.updatedAt = Date.now();
            saveStories();
            renderChat();
            sendUserMessage(prep.lastUserPrompt);
            showToast("กำลังสร้างคำตอบใหม่... 🔄");
          }
        } else if (action === "edit") {
          const bubble = el.querySelector(".msg-bubble");
          if (!bubble) return;

          const currentText = msg.content;
          bubble.innerHTML = `
            <div class="inline-msg-edit-box">
              <textarea class="inline-msg-edit-textarea" rows="3" aria-label="แก้ไขข้อความคำสั่ง">${StoryChatCore.escapeHtml(currentText)}</textarea>
              <div class="inline-msg-edit-actions">
                <button type="button" class="btn-inline-cancel" aria-label="ยกเลิกการแก้ไข">ยกเลิก</button>
                <button type="button" class="btn-inline-save" aria-label="บันทึกการแก้ไขข้อความ">บันทึก</button>
                <button type="button" class="btn-inline-resend" aria-label="บันทึกและส่งให้ AI แต่งใหม่">บันทึก & ส่งใหม่</button>
              </div>
            </div>
          `;
          const textarea = bubble.querySelector(".inline-msg-edit-textarea");
          const btnCancel = bubble.querySelector(".btn-inline-cancel");
          const btnSave = bubble.querySelector(".btn-inline-save");
          const btnResend = bubble.querySelector(".btn-inline-resend");

          textarea.focus();
          textarea.setSelectionRange(
            textarea.value.length,
            textarea.value.length,
          );

          btnCancel.addEventListener("click", () => {
            renderChat();
          });

          btnSave.addEventListener("click", () => {
            const updated = textarea.value.trim();
            if (updated) {
              const currentStory = getActiveStory();
              currentStory.chatMessages = StoryChatCore.editChatMessage(
                currentStory.chatMessages,
                index,
                updated,
              );
              currentStory.updatedAt = Date.now();
              saveStories();
              renderChat();
              showToast("แก้ไขข้อความเรียบร้อยแล้ว ✏️");
            }
          });

          btnResend.addEventListener("click", () => {
            const updated = textarea.value.trim();
            if (updated) {
              const currentStory = getActiveStory();
              currentStory.chatMessages = currentStory.chatMessages.slice(
                0,
                index,
              );
              currentStory.updatedAt = Date.now();
              saveStories();
              renderChat();
              sendUserMessage(updated);
              showToast("ส่งคำสั่งที่แก้ไขใหม่แล้ว 🚀");
            }
          });
        }
      });
    });

    return el;
  }

  function formatAiResponseText(text) {
    if (
      typeof StoryChatCore !== "undefined" &&
      StoryChatCore.formatAiResponseText
    ) {
      return StoryChatCore.formatAiResponseText(text);
    }
    if (!text) return "";
    let safe = escapeHtml(text);
    return safe
      .replace(
        /&lt;story_canvas&gt;[\s\S]*?&lt;\/story_canvas&gt;/gi,
        '<div class="story-canvas-tag-badge"><span class="badge-icon">📖</span> <span class="badge-text">เนื้อหานิยายถูกส่งเข้าหน้ากระดาษตรงกลางเรียบร้อยแล้ว</span></div>',
      )
      .replace(
        /&lt;story_canvas&gt;/gi,
        '<div class="story-canvas-streaming-badge"><span class="badge-pulse"></span> กำลังรังสรรค์เนื้อเรื่องลงกระดาษ...</div>',
      )
      .replace(/&lt;\/story_canvas&gt;/gi, "")
      .replace(
        /\[STORY_START\]/gi,
        '<div style="margin: 8px 0; padding: 10px; border-left: 3px solid var(--accent-blue); background: rgba(59,130,246,0.08); border-radius: 4px;">',
      )
      .replace(/\[STORY_END\]/gi, "</div>")
      .replace(
        /\[⏹️ หยุดการสร้างแล้ว\]/g,
        '<span style="color: var(--text-muted); font-size: 11.5px;">(⏹️ หยุดการสร้างแล้ว)</span>',
      )
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>");
  }

  // เขียนต่อท้าย หรือแทนที่ช่วงข้อความที่ผู้ใช้เลือกสำหรับคำสั่งปรับแก้
  function insertTextIntoEditor(
    text,
    { mode = "append", targetRange = null, isAuto = false } = {},
  ) {
    const cleanText = text.replace(/<br\s*[\/]?>/gi, "\n").trim();
    if (!cleanText) return false;

    const paragraphs = cleanText
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (mode === "replace-selection") {
      if (
        !targetRange ||
        targetRange.collapsed ||
        !canvasBody.contains(targetRange.commonAncestorContainer)
      ) {
        showToast("ไม่พบข้อความที่เลือกเดิม จึงยังไม่ได้เขียนทับเนื้อหา");
        return false;
      }

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(targetRange);
      const htmlToInsert = paragraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("");
      document.execCommand("insertHTML", false, htmlToInsert);
    } else {
      // คำสั่งเขียนต่อจะต่อท้ายเสมอ ไม่แทนที่ข้อความที่เลือกโดยไม่ตั้งใจ
      paragraphs.forEach((pText) => {
        const p = document.createElement("p");
        p.textContent = pText;
        canvasBody.appendChild(p);
      });
    }
    savedEditorRange = null;

    // เลื่อนหน้ากระดาษลงมาที่ย่อหน้าล่าสุดที่เพิ่งแทรก และ auto-scroll container
    setTimeout(() => {
      const scrollContainer = document.querySelector(
        ".editor-scroll-container",
      );
      if (canvasBody.lastElementChild) {
        canvasBody.lastElementChild.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      } else if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 50);

    updateCounts();
    triggerAutoSave();
    if (!isAuto) {
      showToast("แทรกเนื้อหานิยายต่อท้ายเรื่องเรียบร้อยแล้ว ✨");
    }
    return true;
  }

  let activeThinkingTimerInterval = null;

  async function sendUserMessage(overridePrompt = null) {
    const text = (
      overridePrompt !== null ? overridePrompt : chatInput.value
    ).trim();
    if (!text || state.isAiResponding) return;

    const isEditRequest = StoryChatCore.isEditingCommand(text);
    const selectedRange =
      isEditRequest &&
      savedEditorRange &&
      !savedEditorRange.collapsed &&
      canvasBody.contains(savedEditorRange.commonAncestorContainer)
        ? savedEditorRange.cloneRange()
        : null;
    const selectedText = selectedRange?.toString().trim() || "";

    if (isEditRequest && !selectedText) {
      showToast("เลือกข้อความในหน้ากระดาษที่ต้องการปรับแก้ก่อนส่งคำสั่ง");
      return;
    }

    const requestPrompt =
      selectedText && isEditRequest
        ? `${text}\n\n[TEXT_TO_REVISE]\n${selectedText}\n[/TEXT_TO_REVISE]`
        : text;
    const canvasWriteMode =
      isEditRequest && selectedText ? "replace-selection" : "append";

    const currentStory = getActiveStory();
    if (!currentStory.chatMessages) currentStory.chatMessages = [];

    // หากไม่ได้เป็นการ Regenerate ให้ push ข้อความ user ใหม่
    if (overridePrompt === null) {
      currentStory.chatMessages.push({
        role: "user",
        content: text,
        timestamp: Date.now(),
      });
      chatInput.value = "";
    }

    currentStory.updatedAt = Date.now();
    saveStories();
    renderChat();

    state.isAiResponding = true;
    if (btnSendChat) btnSendChat.style.display = "none";
    if (btnAbortChat) btnAbortChat.style.display = "inline-flex";

    activeAbortController = new AbortController();

    const tempAiMsg = {
      role: "ai",
      content: "กำลังคิดและรังสรรค์เนื้อเรื่องตามคำสั่งของคุณ...",
      thinking:
        "วิเคราะห์ธีมเรื่องและคำสั่งนักเขียน\nค้นหาข้อมูลตัวละครและสถานที่ใน Lorebook\nรังสรรค์สำนวนวรรณศิลป์ตาม ThinkingConfig",
      isThinking: true,
      thoughtOpen: true,
      thinkingDuration: "0.0s",
      timestamp: Date.now(),
    };
    currentStory.chatMessages.push(tempAiMsg);
    renderChat();

    // จับเวลาแบบ Real-time ให้ตัวเลข Timer ของ ThoughtLine เดินแบบสดๆ
    const thinkingStartTime = performance.now();
    if (activeThinkingTimerInterval) clearInterval(activeThinkingTimerInterval);
    activeThinkingTimerInterval = setInterval(() => {
      const elapsedDs = Math.floor(
        (performance.now() - thinkingStartTime) / 100,
      );
      const formatted =
        elapsedDs < 600
          ? `${(elapsedDs / 10).toFixed(1)}s`
          : `${Math.floor(elapsedDs / 600)}m ${((elapsedDs % 600) / 10).toFixed(1)}s`;

      const workingTimerEl = chatFeed.querySelector(
        ".thought-line[data-working] .thought-line__timer",
      );
      if (workingTimerEl) {
        workingTimerEl.textContent = formatted;
      }
    }, 100);

    try {
      // 1. เชื่อมต่อสตรีมมิ่งผ่าน Backend (http://localhost:3001/api/chat/stream)
      const backendUrl =
        window.location.port === "3001"
          ? "/api/chat/stream"
          : "http://localhost:3001/api/chat/stream";

      const systemInstructionText = StoryChatCore.buildStoryContextPrompt(
        currentStory,
        canvasBody.innerText || "",
        state.activeStyle,
      );

      const recentChatHistory = (currentStory.chatMessages || [])
        .slice(0, -2)
        .slice(-6)
        .map(
          (m) => `${m.role === "ai" ? "ผู้ช่วย AI" : "นักเขียน"}: ${m.content}`,
        )
        .join("\n\n");

      let streamedSuccessfully = false;

      try {
        const streamResponse = await fetch(backendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: activeAbortController.signal,
          body: JSON.stringify({
            story_id: currentStory.id,
            prompt: requestPrompt,
            systemInstruction: systemInstructionText,
            recentHistory: recentChatHistory,
            activeStyle: state.activeStyle,
            apiKey: state.apiKey || "",
            model: state.apiKey ? "gemini-3.1-flash-lite" : "",
          }),
        });

        if (streamResponse.ok && streamResponse.body) {
          const reader = streamResponse.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let sseBuffer = "";
          let hasStoryStarted = false;

          // จับ Element ของข้อความ AI ตัวล่าสุดใน DOM เพื่ออัปเดตแบบสดๆ
          const lastMsgEl = chatFeed.lastElementChild;
          const thoughtLineEl = lastMsgEl?.querySelector(".thought-line");
          const scrollContainerEl = thoughtLineEl?.querySelector(
            ".thought-line__scroll-container",
          );
          const msgBubbleEl = lastMsgEl?.querySelector(".msg-bubble");

          tempAiMsg.thinking = ""; // เคลียร์เพื่อรับสตรีมคิดสด

          // นำ requestAnimationFrame มา Throttle การ Render DOM เพื่อความลื่นไหล ไม่กระตุก
          let rafId = null;
          let pendingThought = false;
          let pendingStory = false;

          const flushUi = () => {
            if (pendingThought && scrollContainerEl) {
              pendingThought = false;
              const steps = StoryChatCore.parseThinkingSteps(
                tempAiMsg.thinking,
                true,
              );
              scrollContainerEl.innerHTML = formatReasoningContent(
                tempAiMsg.thinking,
                steps,
                true,
              );
              scrollContainerEl.scrollTop = scrollContainerEl.scrollHeight;
            }
            if (pendingStory && msgBubbleEl) {
              pendingStory = false;
              msgBubbleEl.innerHTML = formatAiResponseText(tempAiMsg.content);
              chatFeed.scrollTop = chatFeed.scrollHeight;
            }
          };

          const scheduleUi = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
              rafId = null;
              flushUi();
            });
          };

          while (true) {
            if (activeAbortController?.signal?.aborted) {
              if (rafId) cancelAnimationFrame(rafId);
              throw new DOMException("Aborted", "AbortError");
            }
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const { events, remainingBuffer } =
              typeof StoryChatCore !== "undefined" &&
              StoryChatCore.parseSseBlocks
                ? StoryChatCore.parseSseBlocks(sseBuffer)
                : {
                    events: StoryChatCore.parseSseStreamChunk(sseBuffer),
                    remainingBuffer: "",
                  };
            sseBuffer = remainingBuffer;

            for (const { event, data } of events) {
              if (event === "thinking" && data.chunk) {
                tempAiMsg.thinking = (tempAiMsg.thinking || "") + data.chunk;
                pendingThought = true;
                scheduleUi();
              } else if (event === "story" && data.chunk) {
                if (!hasStoryStarted) {
                  hasStoryStarted = true;
                  tempAiMsg.content = ""; // ล้างข้อความ placeholder
                }
                tempAiMsg.content += data.chunk;
                pendingStory = true;
                scheduleUi();
              } else if (event === "done") {
                if (rafId) {
                  cancelAnimationFrame(rafId);
                  rafId = null;
                }
                if (data.thinking_logs) tempAiMsg.thinking = data.thinking_logs;
                if (data.story_output) tempAiMsg.content = data.story_output;
                if (data.has_canvas && data.canvas_text) {
                  const inserted = insertTextIntoEditor(data.canvas_text, {
                    mode: canvasWriteMode,
                    targetRange: selectedRange,
                    isAuto: true,
                  });
                  tempAiMsg.canvasInsertAttempted = true;
                  if (inserted) {
                    if (data.chat_text) tempAiMsg.content = data.chat_text;
                    tempAiMsg.autoSavedToCanvas = true;
                    showToast(
                      "อัปเดตเนื้อหาในหน้ากระดาษตรงกลางแล้ว ✍️",
                    );
                  } else {
                    tempAiMsg.content = StoryChatCore.cleanCanvasNovelContent(
                      data.canvas_text,
                    );
                  }
                }
                pendingThought = true;
                pendingStory = true;
                flushUi();
                streamedSuccessfully = true;
              } else if (event === "error") {
                if (rafId) cancelAnimationFrame(rafId);
                throw new Error(data.message || "เกิดข้อผิดพลาดในการสตรีม");
              }
            }
          }
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          flushUi();

          if (!streamedSuccessfully) {
            throw new Error(
              "การเชื่อมต่อสตรีมถูกตัดก่อนเสร็จสิ้น (ไม่ได้รับสัญญาณ done)",
            );
          }
        } else {
          throw new Error(`Backend Error ${streamResponse.status}`);
        }
      } catch (streamErr) {
        if (
          streamErr.name === "AbortError" ||
          activeAbortController?.signal?.aborted
        ) {
          throw streamErr; // ส่งต่อไปให้ catch ด้านนอกจัดการแบบ Abort
        }

        console.warn(
          "Backend stream offline/error, falling back to local engine with simulated streaming:",
          streamErr,
        );
        // Fallback กรณี Backend ไม่ได้เปิดใช้งาน - จำลองการสตรีมมิ่งสด
        let fallbackResult;
        if (state.apiKey) {
          fallbackResult = await callGeminiApi(requestPrompt);
        } else {
          fallbackResult = await generateSmartNovelResponse(requestPrompt);
        }

        const fallbackContent =
          typeof fallbackResult === "object" && fallbackResult !== null
            ? fallbackResult.content || ""
            : fallbackResult || "";
        const fallbackThinking =
          typeof fallbackResult === "object" && fallbackResult !== null
            ? fallbackResult.thinking || ""
            : "";

        // จำลองการสตรีมมิ่งของ Reasoning Content ทีละคำ (Simulate streaming reasoning)
        const lastMsgEl = chatFeed.lastElementChild;
        const scrollContainerEl = lastMsgEl?.querySelector(
          ".thought-line__scroll-container",
        );
        const msgBubbleEl = lastMsgEl?.querySelector(".msg-bubble");

        if (fallbackThinking) {
          tempAiMsg.thinking = "";
          const words = fallbackThinking.split(" ");
          for (let i = 0; i < words.length; i++) {
            if (activeAbortController?.signal?.aborted) break;
            tempAiMsg.thinking += (i > 0 ? " " : "") + words[i];
            if (scrollContainerEl) {
              const steps = StoryChatCore.parseThinkingSteps(
                tempAiMsg.thinking,
                true,
              );
              scrollContainerEl.innerHTML = formatReasoningContent(
                tempAiMsg.thinking,
                steps,
                true,
              );
              scrollContainerEl.scrollTop = scrollContainerEl.scrollHeight;
            }
            await new Promise((r) => setTimeout(r, 15));
          }
        }

        tempAiMsg.content = fallbackContent;
        if (msgBubbleEl) {
          msgBubbleEl.innerHTML = formatAiResponseText(tempAiMsg.content);
          chatFeed.scrollTop = chatFeed.scrollHeight;
        }
      }

      if (activeThinkingTimerInterval) {
        clearInterval(activeThinkingTimerInterval);
        activeThinkingTimerInterval = null;
      }

      const totalElapsedSec =
        ((performance.now() - thinkingStartTime) / 1000).toFixed(1) + "s";

      const lastAiMsg =
        currentStory.chatMessages[currentStory.chatMessages.length - 1];
      delete lastAiMsg.isThinking;
      lastAiMsg.thinkingDuration = totalElapsedSec;
      lastAiMsg.thoughtOpen = false; // collapse on settle

      // แยกแท็กเนื้อเรื่อง <story_canvas> หรือใช้ Smart Story Extractor ส่งเข้าหน้ากระดาษตรงกลางอัตโนมัติ (หากยังไม่ได้แยกจาก structured output)
      if (
        !lastAiMsg.autoSavedToCanvas &&
        !lastAiMsg.canvasInsertAttempted
      ) {
        const splitResult = StoryChatCore.splitChatAndCanvasContent(
          lastAiMsg.content,
          requestPrompt,
        );
        if (splitResult.hasCanvasContent && splitResult.canvasText) {
          const inserted = insertTextIntoEditor(splitResult.canvasText, {
            mode: canvasWriteMode,
            targetRange: selectedRange,
            isAuto: true,
          });
          lastAiMsg.canvasInsertAttempted = true;
          if (inserted) {
            lastAiMsg.content = splitResult.chatText;
            lastAiMsg.autoSavedToCanvas = true;
            showToast("อัปเดตเนื้อหาในหน้ากระดาษตรงกลางแล้ว ✍️");
          } else {
            lastAiMsg.content = splitResult.canvasText;
          }
        }
      }

      currentStory.updatedAt = Date.now();
      saveStories();
      renderChat();
    } catch (err) {
      if (activeThinkingTimerInterval) {
        clearInterval(activeThinkingTimerInterval);
        activeThinkingTimerInterval = null;
      }
      const totalElapsedSec =
        ((performance.now() - thinkingStartTime) / 1000).toFixed(1) + "s";
      const lastAiMsg =
        currentStory.chatMessages[currentStory.chatMessages.length - 1];

      if (err.name === "AbortError" || activeAbortController?.signal?.aborted) {
        lastAiMsg.content =
          lastAiMsg.content &&
          lastAiMsg.content !==
            "กำลังคิดและรังสรรค์เนื้อเรื่องตามคำสั่งของคุณ..."
            ? `${lastAiMsg.content} [⏹️ หยุดการสร้างแล้ว]`
            : "⏹️ ยกเลิกการสร้างข้อความแล้ว";
        delete lastAiMsg.isThinking;
        lastAiMsg.thinkingDuration = totalElapsedSec;
        lastAiMsg.thoughtOpen = false;
        renderChat();
        showToast("หยุดการสร้างข้อความแล้ว ⏹️");
      } else {
        console.error(err);
        lastAiMsg.content = `⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อ AI: ${err.message || "กรุณาตรวจสอบ API Key ในปุ่มตั้งค่า (รูปเฟืองด้านบน)"}`;
        lastAiMsg.thinking = "";
        delete lastAiMsg.isThinking;
        lastAiMsg.thinkingDuration = totalElapsedSec;
        lastAiMsg.thoughtOpen = false;
        renderChat();
      }
    } finally {
      if (activeThinkingTimerInterval) {
        clearInterval(activeThinkingTimerInterval);
        activeThinkingTimerInterval = null;
      }
      state.isAiResponding = false;
      activeAbortController = null;
      if (btnAbortChat) btnAbortChat.style.display = "none";
      if (btnSendChat) {
        btnSendChat.style.display = "inline-flex";
        btnSendChat.disabled = false;
      }
    }
  }

  // ================= Story Management Functions =================
  function handleCreateNewStory() {
    const defaultTitle = `นิยายเรื่องใหม่ ${state.stories.length + 1}`;
    const result = StoryChatCore.addNewStory(state.stories, defaultTitle);
    state.stories = result.stories;
    state.activeStoryId = result.activeStoryId;
    saveStories();

    const newStory = getActiveStory();
    loadStoryIntoEditor(newStory);

    showToast(`สร้าง "${newStory.title}" เรียบร้อยแล้ว ✨`);
    if (docTitleInput) {
      docTitleInput.focus();
      docTitleInput.select();
    }
  }

  function handleSwitchStory(storyId) {
    try {
      const result = StoryChatCore.switchStory(state.stories, storyId);
      state.activeStoryId = result.activeStoryId;
      saveStories();
      loadStoryIntoEditor(result.story);
      closeModal("modal-stories-list");
      showToast(`เปิดเขียนเรื่อง "${result.story.title}" เรียบร้อย`);
    } catch (err) {
      showToast(err.message);
    }
  }

  function handleDeleteStory(storyId) {
    const storyToDelete = state.stories.find((s) => s.id === storyId);
    if (!storyToDelete) return;

    showConfirmDialog({
      title: "ลบนิยายเรื่องนี้",
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบเรื่อง "${storyToDelete.title}"? ข้อมูลทั้งหมดรวมถึงบันทึกและประวัติแชทจะถูกลบถาวร`,
      acceptText: "ยืนยันลบเรื่อง",
      onAccept: () => {
        const result = StoryChatCore.deleteStory(
          state.stories,
          state.activeStoryId,
          storyId,
        );
        state.stories = result.stories;
        state.activeStoryId = result.activeStoryId;
        saveStories();

        const currentStory = getActiveStory();
        loadStoryIntoEditor(currentStory);
        renderStoriesList();
        showToast(`ลบเรื่อง "${storyToDelete.title}" เรียบร้อยแล้ว`);
      },
    });
  }

  function renderStoriesList() {
    if (!storiesListContainer) return;

    if (state.stories.length === 0) {
      storiesListContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">ไม่มีรายการนิยาย</div>`;
      return;
    }

    storiesListContainer.innerHTML = state.stories
      .map((s) => {
        const isActive = s.id === state.activeStoryId;
        const formattedDate = new Date(
          s.updatedAt || Date.now(),
        ).toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const textLen = (s.content || "").replace(/<[^>]+>/g, "").trim().length;

        return `
        <div class="story-card-item ${isActive ? "active" : ""}">
          <div class="story-card-info">
            <div class="story-card-title">
              <span>${escapeHtml(s.title || "นิยายไม่มีชื่อ")}</span>
              ${isActive ? '<span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--accent-blue); color: #fff; font-weight: normal;">กำลังเขียน</span>' : ""}
            </div>
            <div class="story-card-meta">
              <span>🕒 แก้ไขล่าสุด: ${formattedDate}</span>
              <span>📝 ~${textLen.toLocaleString()} ตัวอักษร</span>
            </div>
          </div>
          <div class="story-card-actions">
            ${!isActive ? `<button class="btn-story-select" data-story-id="${s.id}">เปิดเขียน</button>` : ""}
            <button class="btn-story-delete" data-del-story-id="${s.id}" title="ลบเรื่องนี้">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/></svg>
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    storiesListContainer
      .querySelectorAll(".btn-story-select")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const sId = btn.getAttribute("data-story-id");
          handleSwitchStory(sId);
        });
      });

    storiesListContainer
      .querySelectorAll(".btn-story-delete")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const sId = btn.getAttribute("data-del-story-id");
          handleDeleteStory(sId);
        });
      });
  }

  // ================= Built-in Smart Novel Engine (Offline Fallback) =================
  async function generateSmartNovelResponse(prompt) {
    await new Promise((r) => setTimeout(r, 600));

    const currentStory = getActiveStory();
    const mainChar =
      currentStory.characters?.[0]?.name?.split(" ")[0] || "ตัวเอก";
    const p = prompt.toLowerCase();

    const baseThinking =
      `[Gemini ThinkingConfig: includeThoughts=true]\n` +
      `🧠 1. ตรวจสอบบริบท: นิยายเรื่อง "${currentStory.title}" | สไตล์: [${state.activeStyle}]\n` +
      `🧠 2. วิเคราะห์ตัวละครหลัก: ${mainChar} และข้อมูลสถานที่/ไทม์ไลน์ใน Lorebook\n` +
      `🧠 3. สรุปแนวทางการสร้าง: ปฏิบัติตามกฎ 5 ข้อ แยกเนื้อหานิยายใส่แท็ก <story_canvas>`;

    const isWritingCommand =
      p.includes("เขียน") ||
      p.includes("แต่ง") ||
      p.includes("เกลา") ||
      StoryChatCore.isEditingCommand(prompt) ||
      p.includes("บทที่") ||
      p.includes("ลงกระดาษ") ||
      p.includes("ฉาก") ||
      p.includes("ต่อ") ||
      p.includes("เล่า") ||
      p.includes("บทสนทนา");

    if (isWritingCommand) {
      if (
        StoryChatCore.isEditingCommand(prompt) ||
        p.includes("เกลา") ||
        p.includes("ตรวจ")
      ) {
        return {
          thinking:
            baseThinking +
            `\n🧠 4. เกลาสำนวน: ตรวจสอบคำซ้ำ ปรับจังหวะ และนำเนื้อหานิยายใส่ <story_canvas>`,
          content:
            `เกลาสำนวนฉากนี้ให้เรียบร้อยแล้วครับ ✨\n\n` +
            `<story_canvas>\n` +
            `หยาดพิรุณราตรีสาดซัดกระทบร่างดั่งคมมีดที่เย็นเยียบ ท่ามกลางซากปรักหักพังของนครโบราณ ${mainChar}กุมวัตถุลึกลับไว้แนบอก แสงเรืองรองสีครามที่สั่นระริกบ่งบอกว่า ประตูสู่ห้วงมิติที่ไม่ควรเปิดออก... ได้เริ่มตื่นขึ้นแล้ว\n` +
            `</story_canvas>`,
        };
      }

      return {
        thinking:
          baseThinking +
          `\n🧠 4. แต่งเนื้อเรื่องฉากถัดไป: บรรจุเนื้อเรื่องในแท็ก <story_canvas> เริ่มบรรทัดแรกด้วยเนื้อหาทันทีโดยไม่มีบทนำ`,
        content:
          `แต่งเนื้อเรื่องต่อให้เรียบร้อยแล้วครับ ✨\n\n` +
          `<story_canvas>\n` +
          `เสียงฝีเท้าหนักหน่วงก้องสะท้อนมาจากเงามืดด้านหลังกำแพงหินผุกร่อน ${mainChar}ชะงักฝีเท้า ลมหายใจสะดุดเมื่อเงาดำขนาดมหึมาค่อยๆ ก่อตัวขึ้นในม่านหมอก\n\n` +
          `"เจ้าไม่อาจหลบหนีโชคชะตาที่ถูกผนึกไว้ได้หรอก..." เสียงนั้นเยียบเย็นราวกับลอยขึ้นมาจากก้นบึ้งของห้วงมิติ\n\n` +
          `${mainChar}สูดลมหายใจลึก กำวัตถุในมือแน่นจนข้อนิ้วขาวซีด แสงสีฟ้าปะทุขึ้นเป็นวงแหวนเวทหมุนวนรอบกาย "ถ้าคิดว่าจะแย่งมันไปได้ง่ายๆ... ก็ลองเข้ามาดู!"\n` +
          `</story_canvas>`,
      };
    }

    // กรณีผู้ใช้ชวนคุย ปรึกษาพล็อต หรือวางโครงเรื่อง (กฎข้อ 1: ตอบกลับตามปกติเพื่อแสดงในช่องแชท)
    return {
      thinking:
        baseThinking +
        `\n🧠 4. แลกเปลี่ยนมุมมองโครงเรื่อง: ตอบกลับตามปกติเพื่อแสดงในช่องแชทด้านขวา`,
      content:
        `สำหรับพล็อตเรื่อง **"${currentStory.title}"** ในสไตล์ **${state.activeStyle}**:\n\n` +
        `ข้อเสนอแนะในการพัฒนาโครงเรื่อง:\n` +
        `1. **จุดเปลี่ยนสำคัญ (Plot Twist):** ให้พลังของ ${mainChar} เชื่อมโยงกับประวัติศาสตร์ที่สาบสูญของดินแดนนี้\n` +
        `2. **ความสัมพันธ์ของตัวละคร:** สร้างสถานการณ์ที่บีบคั้นให้ตัวละครต้องตัดสินใจร่วมกัน\n\n` +
        `หากต้องการให้ผมเริ่มเขียนฉากไหนลงหน้ากระดาษตรงกลาง สามารถสั่งได้เลยครับ เช่นพิมพ์ว่า *"เขียนเนื้อเรื่อง..."* หรือ *"แต่งบทที่..."* ได้เลยครับ 😊`,
    };
  }

  // ================= Live Gemini API Connection (Standard: gemini-3.8-flash & gemini-3.1-flash-lite) =================
  async function callGeminiApi(prompt) {
    const currentStory = getActiveStory();
    const systemInstructionText = StoryChatCore.buildStoryContextPrompt(
      currentStory,
      canvasBody.innerText || "",
      state.activeStyle,
    );

    // ดึงประวัติการสนทนา 6 ข้อความล่าสุดมาสรุปเป็นบริบทต่อเนื่อง (ป้องกันบั๊ก Role สลับกันเวลาลบข้อความแชท)
    const recentChatHistory = (currentStory.chatMessages || [])
      .slice(0, -2)
      .slice(-6)
      .map(
        (m) => `${m.role === "ai" ? "ผู้ช่วย AI" : "นักเขียน"}: ${m.content}`,
      )
      .join("\n\n");

    const fullPromptText = [
      systemInstructionText,
      recentChatHistory
        ? `\n[ประวัติการสนทนาล่าสุด]\n${recentChatHistory}`
        : "",
      `\n[คำสั่งของนักเขียน]\n${prompt}`,
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: fullPromptText }],
        },
      ],
      generationConfig: {
        temperature: 0.85,
        topP: 0.95,
        maxOutputTokens: 4096,
        thinkingConfig: {
          includeThoughts: true,
          thinkingBudget: 512,
        },
      },
    };

    // ใช้โมเดลความเร็วสูงที่มีเสถียรภาพ และมีระบบ Fallback ลำดับถัดไป (gemini-3.8-flash -> gemini-3.1-flash-lite -> gemini-2.5-flash)
    const modelsToTry = [
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
    ];
    let lastError = null;

    for (const modelName of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": state.apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          const parts = data.candidates?.[0]?.content?.parts || [];
          let thinkingText = "";
          let answerText = "";

          for (const part of parts) {
            if (!part.text) continue;
            if (part.thought) {
              thinkingText += (thinkingText ? "\n\n" : "") + part.text;
            } else {
              answerText += part.text;
            }
          }

          // หากไม่มี part แยก แต่มี text
          if (!answerText && parts.length > 0) {
            answerText = parts
              .map((p) => p.text)
              .filter(Boolean)
              .join("\n");
          }

          if (answerText) {
            return {
              content: answerText,
              thinking: thinkingText,
            };
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error?.message || `HTTP ${res.status}`;
          lastError = new Error(`(${modelName}) ${errMsg}`);

          // ถ้า API Key ไม่ถูกต้อง (401/403) ให้หยุดแจ้งเตือนทันที
          if (res.status === 401 || res.status === 403) {
            break;
          }
          console.warn(
            `[Client Gemini Notice] โมเดล ${modelName} ตอบกลับ HTTP ${res.status} กำลังลองโมเดลถัดไป...`,
          );
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        lastError = fetchErr;
        if (fetchErr.name === "AbortError") {
          console.warn(
            `[Client Timeout] โมเดล ${modelName} ไม่ตอบสนองใน 10 วินาที กำลังลองโมเดลถัดไป...`,
          );
        }
      }
    }

    throw lastError || new Error("ไม่สามารถเชื่อมต่อ Gemini API ได้");
  }

  function handleTabChange(tab) {
    if (tab === "reviews") {
      showToast("โหมดตรวจทาน: กำลังส่งคำขอให้ AI วิเคราะห์...");
      rightSidebar.classList.remove("collapsed");
      chatInput.value =
        "ช่วยตรวจทานเนื้อหานิยายตอนล่าสุด ตรวจสอบคำผิด คำซ้ำ ความลื่นไหล และเกลาสำนวนให้สละสลวยขึ้น";
      sendUserMessage();
    } else if (tab === "audio") {
      if ("speechSynthesis" in window) {
        const textToRead =
          lastSelectedText || (canvasBody.innerText || "").slice(-600);
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          showToast("หยุดการอ่านออกเสียงแล้ว ⏹️");
        } else if (textToRead.trim()) {
          const utterance = new SpeechSynthesisUtterance(textToRead);
          utterance.lang = "th-TH";
          window.speechSynthesis.speak(utterance);
          showToast("กำลังอ่านออกเสียงข้อความ 🔊 (คลิกอีกครั้งเพื่อหยุด)");
        } else {
          showToast("ไม่มีข้อความสำหรับอ่านออกเสียง");
        }
      } else {
        showToast("เบราว์เซอร์ไม่รองรับระบบสังเคราะห์เสียง");
      }
    }
  }

  // ================= Modal Helpers (Accessible WAI-ARIA Focus Trap & Escape) =================
  let lastActiveElementBeforeModal = null;
  let activeModalKeydownHandler = null;

  window.openModal = function (id) {
    const m = document.getElementById(id);
    if (!m) return;

    lastActiveElementBeforeModal = document.activeElement;
    m.classList.add("active");
    m.setAttribute("aria-hidden", "false");

    const focusableElements = m.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (firstFocusable) {
      setTimeout(() => firstFocusable.focus(), 60);
    }

    if (activeModalKeydownHandler) {
      document.removeEventListener("keydown", activeModalKeydownHandler);
    }

    activeModalKeydownHandler = function (e) {
      if (e.key === "Escape") {
        closeModal(id);
        return;
      }

      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable?.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable?.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", activeModalKeydownHandler);
  };

  window.closeModal = function (id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.remove("active");
      m.setAttribute("aria-hidden", "true");
    }

    if (activeModalKeydownHandler) {
      document.removeEventListener("keydown", activeModalKeydownHandler);
      activeModalKeydownHandler = null;
    }

    if (
      lastActiveElementBeforeModal &&
      typeof lastActiveElementBeforeModal.focus === "function"
    ) {
      lastActiveElementBeforeModal.focus();
      lastActiveElementBeforeModal = null;
    }
  };

  document.querySelectorAll(".modal-backdrop").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });

  // ================= Utility Functions =================
  function showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M13.5 4.5l-7 7-3.5-3.5"/></svg>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`ดาวน์โหลด ${filename} เรียบร้อย`);
  }

  function htmlToMarkdown(html) {
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
      .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
      .replace(/<b>(.*?)<\/b>/gi, "**$1**")
      .replace(/<em>(.*?)<\/em>/gi, "*$1*")
      .replace(/<i>(.*?)<\/i>/gi, "*$1*")
      .replace(/<blockquote>(.*?)<\/blockquote>/gi, "> $1\n\n")
      .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
      .replace(/<br\s*[\/]?>/gi, "\n")
      .replace(/<[^>]+>/g, "");
  }

  function escapeHtml(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  init();
});
