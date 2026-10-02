export function albumPage(token: string, room: number) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>选择照片</title>
  <style>
    :root { color: #1c1915; background: #f3efe6; font-family: "PingFang SC", "Noto Sans SC", sans-serif; }
    body { margin: 0; padding: 24px 20px 40px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    p { color: #6f675c; line-height: 1.5; }
    .btn, button {
      display: block; width: 100%; margin-top: 16px; border: 0; border-radius: 999px;
      background: #0f6e56; color: white; font: inherit; font-weight: 650; padding: 14px 16px;
    }
    button.ghost { background: transparent; color: #1c1915; border: 1px solid #e4dccf; }
    input[type="file"] { display: none; }
    #status { min-height: 1.5em; }
    ul { padding-left: 18px; }
  </style>
</head>
<body>
  <h1>选择照片</h1>
  <p>从手机相册一次最多选择 ${room} 张。这是系统相册，不受微信选图 20 张的限制。</p>
  <p id="status">还没有选择照片。</p>
  <ul id="names"></ul>
  <label class="btn">从相册选择<input id="picker" type="file" accept="image/*" multiple /></label>
  <button id="done" class="ghost" type="button">完成并返回</button>
  <script src="https://res.wx.qq.com/open/js/jweixin-1.6.0.js"></script>
  <script>
    const token = ${JSON.stringify(token)};
    const room = ${room};
    const picker = document.querySelector("#picker");
    const status = document.querySelector("#status");
    const names = document.querySelector("#names");
    let uploaded = 0;

    picker.addEventListener("change", async () => {
      const files = Array.from(picker.files || []);
      picker.value = "";
      const remain = room - uploaded;
      if (!files.length) return;
      if (remain <= 0) {
        status.textContent = "已经选满 " + room + " 张。";
        return;
      }
      const take = files.slice(0, remain);
      if (files.length > remain) status.textContent = "超过上限，只再上传 " + remain + " 张。";
      for (let index = 0; index < take.length; index += 1) {
        const file = take[index];
        status.textContent = "正在上传 " + (index + 1) + " / " + take.length;
        const body = new FormData();
        body.append("file", file, file.name || ("图片" + (index + 1) + ".jpg"));
        const response = await fetch("/api/public/album/" + token + "/files", { method: "POST", body });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          status.textContent = data.message || "上传失败";
          return;
        }
        uploaded += 1;
        const item = document.createElement("li");
        item.textContent = data.originalName || file.name;
        names.appendChild(item);
      }
      status.textContent = "已上传 " + uploaded + " 张。点完成返回打印页。";
    });

    document.querySelector("#done").addEventListener("click", () => {
      const mini = window.wx && wx.miniProgram;
      if (mini && mini.navigateBack) mini.navigateBack({ delta: 1 });
      else history.back();
    });
  </script>
</body>
</html>`;
}
