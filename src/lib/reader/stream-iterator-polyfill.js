/**
 * 29: `ReadableStream` async iteratori (`for await (… of stream)`, `stream.values()`) — Safari 17/18 (macOS, iOS)
 * da yo'q, pdf.js 6 esa unga tayanadi (`page.getTextContent()`, worker'dagi DecompressionStream). Legacy build buni
 * polyfill qilmaydi: Safari'da matn qatlami hech qachon tayyor bo'lmay, reader bo'sh qolardi.
 *
 * Yagona manba: asosiy oqimda `range-transport.ts` import qiladi, worker uchun `scripts/copy-pdf-worker.mjs`
 * shu faylni `public/pdf.worker.min.mjs` boshiga qo'shadi. Oddiy skript (ES2017), faqat yo'q bo'lsa o'rnatadi.
 */
(function () {
  var RS = typeof globalThis !== "undefined" ? globalThis.ReadableStream : undefined;
  if (!RS || typeof Symbol === "undefined" || !Symbol.asyncIterator) return;
  var proto = RS.prototype;
  if (typeof proto[Symbol.asyncIterator] === "function") return;
  function values(options) {
    var preventCancel = !!(options && options.preventCancel);
    var reader = this.getReader();
    var iterator = {
      next: function () {
        return reader.read().then(
          function (result) {
            if (result.done) reader.releaseLock();
            return result;
          },
          function (error) {
            reader.releaseLock();
            throw error;
          },
        );
      },
      return: function (value) {
        if (preventCancel) {
          reader.releaseLock();
          return Promise.resolve({ done: true, value: value });
        }
        var cancelled = reader.cancel(value);
        reader.releaseLock();
        return cancelled.then(function () {
          return { done: true, value: value };
        });
      },
    };
    iterator[Symbol.asyncIterator] = function () {
      return this;
    };
    return iterator;
  }
  Object.defineProperty(proto, "values", { value: values, writable: true, configurable: true });
  Object.defineProperty(proto, Symbol.asyncIterator, { value: values, writable: true, configurable: true });
})();
