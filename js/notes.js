/**
 * js/notes.js
 * จัดการ Lorebook: ข้อมูลตัวละคร, สถานที่, ไทม์ไลน์, และภาพรวมโครงเรื่อง
 */

const NovelNotes = (function () {
  /**
   * เรนเดอร์การ์ดรายการในแถบ Lorebook (Notes Sidebar)
   */
  function renderLoreCards({ container, items, type, onSelect, onDelete }) {
    if (!container) return;
    container.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = `
        <div class="note-empty-state">
          ยังไม่มีข้อมูล${type} คลิกปุ่ม + ด้านบนเพื่อเพิ่ม
        </div>
      `;
      return;
    }

    items.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "note-card";
      card.setAttribute("data-id", item.id || index);

      const title = item.name || item.title || "ไม่มีชื่อ";
      const sub = item.role || item.type || item.time || "";
      const desc = item.desc || "";

      card.innerHTML = `
        <div class="note-card-header">
          <div class="note-card-title-group">
            <span class="note-card-title">${StoryChatCore.escapeHtml(title)}</span>
            ${sub ? `<span class="note-card-tag">${StoryChatCore.escapeHtml(sub)}</span>` : ""}
          </div>
          <button class="note-card-del-btn" data-del-idx="${index}" title="ลบรายการนี้" aria-label="ลบรายการ ${StoryChatCore.escapeHtml(title)}">✕</button>
        </div>
        ${desc ? `<div class="note-card-desc">${StoryChatCore.escapeHtml(desc)}</div>` : ""}
      `;

      card.addEventListener("click", () => {
        if (typeof onSelect === "function") onSelect(item);
      });

      const delBtn = card.querySelector(".note-card-del-btn");
      if (delBtn) {
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (typeof onDelete === "function") onDelete(index, item);
        });
      }

      container.appendChild(card);
    });
  }

  return {
    renderLoreCards,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = NovelNotes;
}
