import React from 'react';
import { ResponseTab, ResponseFormat } from '../../types';

interface ResponsePanelProps {
  response: string;
  responseStatus: number | null;
  responseTime: number | null;
  responseSize: string | null;
  responseHeaders: Record<string, string>;
  responseCookies: Record<string, string>;
  activeResponseTab: ResponseTab;
  setActiveResponseTab: (tab: ResponseTab) => void;
  responseFormat: ResponseFormat;
  setResponseFormat: (format: ResponseFormat) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const ResponsePanel: React.FC<ResponsePanelProps> = ({
  response,
  responseStatus,
  responseTime,
  responseSize,
  responseHeaders,
  responseCookies,
  activeResponseTab,
  setActiveResponseTab,
  responseFormat,
  setResponseFormat,
  searchTerm,
  setSearchTerm,
}) => {
  // Format JSON for display
  const formatJSON = (jsonString: string) => {
    try {
      const obj = JSON.parse(jsonString);
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return jsonString; // Return as-is if not valid JSON
    }
  };

  // Render the formatted response body based on format selection
  const renderResponseBody = () => {
    if (!response) return null;
    
    switch (responseFormat) {
      case "pretty":
        try {
          return <pre className="json-viewer">{formatJSON(response)}</pre>;
        } catch {
          return <pre className="response-output">{response}</pre>;
        }
      case "raw":
        return <pre className="response-output">{response}</pre>;
      case "preview":
        // For HTML preview - in a real app you'd use an iframe or sanitized HTML
        if (responseHeaders["content-type"]?.includes("html")) {
          return <div dangerouslySetInnerHTML={{ __html: response }} />;
        }
        return <pre className="response-output">{response}</pre>;
    }
  };

  return (
    <section className="response-panel">
      <div className="response-tabs">
        <button 
          className={`response-tab-button ${activeResponseTab === "body" ? "active" : ""}`}
          onClick={() => setActiveResponseTab("body")}
        >
          Body
        </button>
        <button 
          className={`response-tab-button ${activeResponseTab === "headers" ? "active" : ""}`}
          onClick={() => setActiveResponseTab("headers")}
        >
          Headers
        </button>
        <button 
          className={`response-tab-button ${activeResponseTab === "cookies" ? "active" : ""}`}
          onClick={() => setActiveResponseTab("cookies")}
        >
          Cookies
        </button>
      </div>

      <div className="response-info">
        <span className={responseStatus && responseStatus < 400 ? "status-success" : "status-error"}>
          Status: {responseStatus || "-"}
        </span>
        <span>Time: {responseTime ? `${responseTime}ms` : "-"}</span>
        <span>Size: {responseSize || "-"}</span>
      </div>

      {/* Body Tab */}
      {activeResponseTab === "body" && (
        <>
          <div className="response-actions">
            <div className="format-options">
              <button 
                className={`format-option ${responseFormat === "pretty" ? "active" : ""}`} 
                onClick={() => setResponseFormat("pretty")}
              >
                Pretty
              </button>
              <button 
                className={`format-option ${responseFormat === "raw" ? "active" : ""}`} 
                onClick={() => setResponseFormat("raw")}
              >
                Raw
              </button>
              <button 
                className={`format-option ${responseFormat === "preview" ? "active" : ""}`} 
                onClick={() => setResponseFormat("preview")}
              >
                Preview
              </button>
            </div>
            <div className="search-response">
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="response-content">
            {renderResponseBody()}
          </div>
        </>
      )}

      {/* Headers Tab */}
      {activeResponseTab === "headers" && (
        <div className="response-table-container">
          <table className="response-table">
            <thead>
              <tr>
                <th>Header</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(responseHeaders).map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cookies Tab */}
      {activeResponseTab === "cookies" && (
        <div className="response-table-container">
          <table className="response-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(responseCookies).map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ResponsePanel;