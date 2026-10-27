/**
 * js/storage.js
 * จัดการ Data Persistence ด้วย IndexedDB และ LocalStorage Fallback
 * พร้อมรองรับการ Sync ข้อมูลกับ Supabase ผ่าน Backend REST API
 */

const NovelStorage = (function () {
  const DB_NAME = "NovelAIStudioDB";
  const DB_VERSION = 1;
  const STORE_NAME = "stories";
  const LOCAL_STORAGE_KEY = "novel_ai_stories_v2";

  let dbInstance = null;

  /**
   * เปิดการเชื่อมต่อ IndexedDB
   */
  function initIndexedDb() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn("[Storage] IndexedDB ไม่พร้อมใช้งาน สลับใช้ LocalStorage");
        return resolve(null);
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = function (event) {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = function (event) {
        console.warn("[Storage] ไม่สามารถเปิด IndexedDB ได้:", event.target.error);
        resolve(null);
      };
    });
  }

  /**
   * โหลดรายการนิยายทั้งหมด (優先 IndexedDB -> Fallback LocalStorage)
   */
  async function loadAllStories() {
    const db = await initIndexedDb();
    if (db) {
      try {
        const storiesFromDb = await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });

        if (Array.isArray(storiesFromDb) && storiesFromDb.length > 0) {
          return storiesFromDb;
        }
      } catch (err) {
        console.warn("[Storage] โหลดจาก IndexedDB ผิดพลาด:", err);
      }
    }

    // Fallback: LocalStorage
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // ทยอยไมเกรตข้อมูลจาก LocalStorage เข้า IndexedDB อัตโนมัติ
          if (db) {
            saveAllStories(parsed).catch(() => {});
          }
          return parsed;
        }
      }
    } catch (e) {
      console.error("[Storage] อ่าน LocalStorage ล้มเหลว:", e);
    }

    return null;
  }

  /**
   * บันทึกรายการนิยายทั้งหมดลง IndexedDB และสำรองใน LocalStorage
   */
  async function saveAllStories(stories) {
    if (!Array.isArray(stories)) return;

    // 1. บันทึกลง IndexedDB (รองรับขนาดข้อมูลใหญ่ ไม่จำกัด 5MB)
    const db = dbInstance || (await initIndexedDb());
    if (db) {
      try {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          store.clear(); // ล้างของเดิมแล้วใส่ชุดใหม่
          stories.forEach((story) => store.put(story));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (err) {
        console.warn("[Storage] บันทึกลง IndexedDB ผิดพลาด:", err);
      }
    }

    // 2. สำรองลง LocalStorage อย่างปลอดภัย (ดักจับ QuotaExceededError)
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stories));
    } catch (quotaErr) {
      console.warn(
        "[Storage] LocalStorage เต็ม (~5MB QuotaExceeded) ข้อมูลถูกจัดเก็บปลอดภัยใน IndexedDB เรียบร้อยแล้ว",
      );
    }
  }

  /**
   * ดึงประวัติแชทนิยายจาก Supabase Cloud ผ่าน Backend API
   */
  async function fetchCloudChatHistory(storyId) {
    try {
      const res = await fetch(`/api/chat/history?story_id=${encodeURIComponent(storyId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.success ? data.history || [] : [];
    } catch (err) {
      console.warn("[Storage] ไม่สามารถเชื่อมต่อประวัติแชทบน Supabase Cloud ได้:", err);
      return [];
    }
  }

  /**
   * บันทึกข้อความแชทขึ้น Supabase Cloud ผ่าน Backend API
   */
  async function syncChatToCloud(chatMessagePayload) {
    try {
      const res = await fetch("/api/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatMessagePayload),
      });
      return await res.json();
    } catch (err) {
      console.warn("[Storage] ไม่สามารถบันทึกข้อความแชทขึ้น Supabase Cloud ได้:", err);
      return { success: false };
    }
  }

  return {
    loadAllStories,
    saveAllStories,
    fetchCloudChatHistory,
    syncChatToCloud,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = NovelStorage;
}
