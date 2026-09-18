/** Copy sang clipboard. */

/** Copy chữ. Có nhánh dự phòng cho trình duyệt cũ / ngữ cảnh không bảo mật. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Rơi xuống nhánh execCommand bên dưới.
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    // Nằm ngoài màn hình để không làm nhảy layout khi focus.
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.setAttribute("readonly", "");
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
