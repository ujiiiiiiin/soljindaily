// Preview용 저장소 호환 코드
// 원본 앱이 사용하는 window.storage.get/set/remove API를 브라우저 localStorage로 연결합니다.
if (!window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(key);
      return value === null ? null : { value };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { value };
    },
    async remove(key) {
      localStorage.removeItem(key);
      return { value: null };
    }
  };
}
