import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import "../public/styles/switch.css";
import "../public/styles/common.css";

const Popup = () => {
  const [appState, setAppState] = useState<boolean>();

  useEffect(() => {
    chrome.storage.local.get("appState", (data) => {
      setAppState(data.appState);
    });
  });

  const toggle = () => {
    chrome.storage.local.set({ appState: !appState });
    setAppState(!appState);
  };

  return (
    <>
      <div className="row row-center">
        <div className="column">
          <label className="form-switch">
            <input
              type="checkbox"
              defaultChecked={appState}
              onClick={toggle}
            ></input>
            <i></i>
          </label>
        </div>
        <div className="column column-center">
          <div className="text">Enable extension</div>
        </div>
      </div>
    </>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <div className="canto-translate canto-translate-popup">
      <div className="row row-center">
        <h2>CantoTranslate</h2>
      </div>
      <Popup />
    </div>
  </React.StrictMode>,
  document.getElementById("root")
);
