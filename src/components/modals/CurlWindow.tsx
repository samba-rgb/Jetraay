import React from "react";

interface CurlWindowProps {
  curlCommand: string;
  onClose: () => void;
}

const CurlWindow: React.FC<CurlWindowProps> = ({ curlCommand, onClose }) => {
  return (
    <div className="curl-window">
      <div className="curl-header">
        <span>cURL Command</span>
        <button onClick={onClose}>×</button>
      </div>
      <textarea readOnly value={curlCommand} className="curl-textarea" />
      <button
        onClick={() => {
          const newWindow = window.open("", "Curl Command", "width=600,height=400");
          if (newWindow) {
            newWindow.document.write(
              `<html><head><title>cURL Command</title></head><body><textarea style='width:100%;height:90%;'>${curlCommand}</textarea><button onclick='navigator.clipboard.writeText(document.querySelector("textarea").value).then(() => alert("Copied!"))'>Copy</button></body></html>`
            );
          }
        }}
        className="copy-button"
      >
        Open in Window
      </button>
    </div>
  );
};

export default CurlWindow;