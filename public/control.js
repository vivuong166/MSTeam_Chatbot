(function () {
  "use strict";

  function setText(element, value) {
    if ("textContent" in element) {
      element.textContent = value;
    } else {
      element.innerText = value;
    }
  }

  function request(method, url, payload, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader("Accept", "application/json");

    if (payload) {
      xhr.setRequestHeader("Content-Type", "application/json");
    }

    xhr.onreadystatechange = function () {
      var data = null;

      if (xhr.readyState !== 4) {
        return;
      }

      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch (error) {
        callback("Máy chủ trả về dữ liệu không hợp lệ.");
        return;
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        callback((data && data.error && data.error.message) || "Không thể cập nhật trạng thái bot.");
        return;
      }

      callback(null, data);
    };

    xhr.onerror = function () {
      callback("Không kết nối được tới máy chủ bot.");
    };

    xhr.send(payload ? JSON.stringify(payload) : null);
  }

  function renderStatus(status) {
    var statusElement = document.getElementById("status");
    var description = document.getElementById("description");
    var pauseButton = document.getElementById("pause-button");
    var resumeButton = document.getElementById("resume-button");

    statusElement.className = status.autoReply ? "status is-automatic" : "status is-manual";
    setText(statusElement, status.autoReply ? "Bot đang tự động trả lời" : "Bot đang tạm dừng — người thật trả lời");
    setText(
      description,
      status.autoReply
        ? "Tin nhắn mới sẽ được gửi qua Agent và bot sẽ trả lời trên Teams."
        : "Tin nhắn mới chỉ được lưu; Gemini không được gọi và bot không gửi trả lời."
    );
    pauseButton.disabled = !status.autoReply;
    resumeButton.disabled = status.autoReply;
  }

  function showNotice(message) {
    setText(document.getElementById("notice"), message || "");
  }

  function loadStatus() {
    request("GET", "/bot-control/status", null, function (error, status) {
      if (error) {
        showNotice(error);
        return;
      }

      showNotice("");
      renderStatus(status);
    });
  }

  function updateStatus(autoReply) {
    showNotice("Đang cập nhật...");
    request("POST", "/bot-control/status", { autoReply: autoReply }, function (error, status) {
      if (error) {
        showNotice(error);
        return;
      }

      renderStatus(status);
      showNotice(autoReply ? "Bot đã được bật." : "Bot đã dừng. Người thật có thể trả lời.");
    });
  }

  window.onload = function () {
    document.getElementById("pause-button").onclick = function () {
      updateStatus(false);
    };
    document.getElementById("resume-button").onclick = function () {
      updateStatus(true);
    };
    loadStatus();
    window.setInterval(loadStatus, 5000);
  };
}());
