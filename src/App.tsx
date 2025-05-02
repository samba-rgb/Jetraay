import { useState, useEffect } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";

interface HeaderItem {
  id: number;
  enabled: boolean;
  key: string;
  value: string;
}

interface FormDataItem {
  id: number;
  enabled: boolean;
  key: string;
  value: string;
  type: 'text' | 'file';
  file?: File | null;
}

type BodyMode = 'none' | 'form-data' | 'urlencoded' | 'raw' | 'binary' | 'graphql';
type RawContentType = 'text/plain' | 'application/json' | 'application/xml' | 'text/html' | 'application/javascript';
type ResponseTab = 'body' | 'headers' | 'cookies';
type ResponseFormat = 'pretty' | 'raw' | 'preview';

function App() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"headers" | "body">("headers");
  
  // Headers state
  const [headerItems, setHeaderItems] = useState<HeaderItem[]>([
    { id: 1, enabled: true, key: "", value: "" }
  ]);
  
  // Body state
  const [bodyMode, setBodyMode] = useState<BodyMode>("none");
  const [rawContentType, setRawContentType] = useState<RawContentType>("application/json");
  const [rawBody, setRawBody] = useState("");
  const [formDataItems, setFormDataItems] = useState<FormDataItem[]>([
    { id: 1, enabled: true, key: "", value: "", type: "text" }
  ]);
  const [binaryFile, setBinaryFile] = useState<File | null>(null);
  const [graphqlQuery, setGraphqlQuery] = useState("");
  const [graphqlVariables, setGraphqlVariables] = useState("");
  
  // Response state
  const [response, setResponse] = useState("");
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [responseSize, setResponseSize] = useState<string | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseCookies, setResponseCookies] = useState<Record<string, string>>({});
  const [activeResponseTab, setActiveResponseTab] = useState<ResponseTab>("body");
  const [responseFormat, setResponseFormat] = useState<ResponseFormat>("pretty");
  const [searchTerm, setSearchTerm] = useState("");

  // Create headers string from header items
  const getHeadersString = () => {
    return headerItems
      .filter(item => item.enabled && item.key.trim() !== "")
      .map(item => `${item.key}: ${item.value}`)
      .join("\n");
  };

  // Create body based on selected mode
  const getBodyContent = () => {
    if (method === "GET") return null;
    
    switch (bodyMode) {
      case "none":
        return null;
      case "raw":
        return rawBody;
      case "form-data":
        // In a real application, you'd use FormData for file uploads
        // For now, we'll just convert it to a simple string representation
        return formDataItems
          .filter(item => item.enabled && item.key.trim() !== "")
          .map(item => `${item.key}=${item.value}`)
          .join("&");
      case "urlencoded":
        return formDataItems
          .filter(item => item.enabled && item.key.trim() !== "")
          .map(item => `${item.key}=${encodeURIComponent(item.value)}`)
          .join("&");
      case "graphql":
        return JSON.stringify({
          query: graphqlQuery,
          variables: graphqlVariables ? JSON.parse(graphqlVariables) : {}
        });
      case "binary":
        return "Binary data not supported in this demo";
      default:
        return null;
    }
  };

  // Send HTTP request
  async function sendRequest() {
    try {
      const startTime = performance.now();
      
      const headersArray = headerItems
        .filter(item => item.enabled && item.key.trim() !== "")
        .map(item => `${item.key}: ${item.value}`);
      
      // Add content type header if using raw mode
      if (bodyMode === "raw" && !headersArray.some(h => h.toLowerCase().startsWith("content-type:"))) {
        headersArray.push(`Content-Type: ${rawContentType}`);
      }
      
      // Add content type for GraphQL
      if (bodyMode === "graphql" && !headersArray.some(h => h.toLowerCase().startsWith("content-type:"))) {
        headersArray.push("Content-Type: application/json");
      }

      const response = await invoke("run_curl", {
        method,
        url,
        headers: headersArray,
        body: getBodyContent(),
      });

      const endTime = performance.now();
      
      console.log("Backend Response:", response); // Debugging log
      
      // In a real app, the backend would return parsed headers and cookies
      // For this demo, we'll set some mock values
      setResponseStatus(200);
      setResponseTime(Math.round(endTime - startTime));
      setResponseSize(calculateSize(String(response)));
      setResponseHeaders({
        "content-type": "application/json",
        "server": "nginx",
        "date": new Date().toUTCString()
      });
      setResponseCookies({
        "session": "abc123",
        "user": "demo-user"
      });
      
      setResponse(String(response));
    } catch (error) {
      console.error("Error invoking backend:", error); // Debugging log
      setResponseStatus(500);
      setResponse(`Error: ${error}`);
    }
  }
  
  // Calculate response size in KB
  const calculateSize = (data: string) => {
    const bytes = new TextEncoder().encode(data).length;
    return (bytes / 1024).toFixed(1) + " KB";
  };

  // Add a new header row
  const addHeaderRow = () => {
    const newId = headerItems.length > 0 
      ? Math.max(...headerItems.map(item => item.id)) + 1 
      : 1;
    
    setHeaderItems([
      ...headerItems, 
      { id: newId, enabled: true, key: "", value: "" }
    ]);
  };

  // Update a header item
  const updateHeaderItem = (id: number, field: keyof HeaderItem, value: any) => {
    setHeaderItems(headerItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Remove a header item
  const removeHeaderItem = (id: number) => {
    setHeaderItems(headerItems.filter(item => item.id !== id));
  };

  // Add a new form data row
  const addFormDataRow = () => {
    const newId = formDataItems.length > 0 
      ? Math.max(...formDataItems.map(item => item.id)) + 1 
      : 1;
    
    setFormDataItems([
      ...formDataItems, 
      { id: newId, enabled: true, key: "", value: "", type: "text" }
    ]);
  };

  // Update a form data item
  const updateFormDataItem = (id: number, field: keyof FormDataItem, value: any) => {
    setFormDataItems(formDataItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Remove a form data item
  const removeFormDataItem = (id: number) => {
    setFormDataItems(formDataItems.filter(item => item.id !== id));
  };

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
    <div className="app-container">
      <aside className="sidebar">
        <div className="app-branding">
          <img src="/jetraay.png" alt="Jetraay Logo" className="app-logo" />
          <span className="app-name">Jetraay</span>
        </div>
        
        <div className="sidebar-section">
          <h3 className="sidebar-title">Collections</h3>
        </div>
        
        <div className="sidebar-section">
          <h3 className="sidebar-title">History</h3>
        </div>
        
        <div className="sidebar-section">
          <h3 className="sidebar-title">Environments</h3>
        </div>
      </aside>

      <main className="main-content">
        {/* New Horizontal Layout */}
        <header className="top-toolbar">
          <input
            className="api-name-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="API Name"
          />
          <div>
            <button className="save-button">Save</button>
            <button className="share-button">Share</button>
          </div>
        </header>

        <header className="top-toolbar">
          <select 
            className="method-selector"
            value={method} 
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
            <option value="HEAD">HEAD</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>
          <input
            className="url-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter the API URL"
          />
          <button className="send-button" onClick={sendRequest}>Send</button>
        </header>

        <div className="tab-system">
          <div className="tab active">Request 1</div>
          <div className="tab">+</div>
        </div>

        <section className="request-section">
          <div className="headers-body-tabs">
            <button 
              className={`tab-button ${activeTab === "headers" ? "active" : ""}`}
              onClick={() => setActiveTab("headers")}
            >
              Headers
            </button>
            <button 
              className={`tab-button ${activeTab === "body" ? "active" : ""}`}
              onClick={() => setActiveTab("body")}
            >
              Body
            </button>
          </div>

          {/* Headers Tab Content */}
          <div className={activeTab === "headers" ? "" : "hidden"}>
            <div className="headers-table">
              {headerItems.map(item => (
                <div key={item.id} className="header-row">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => updateHeaderItem(item.id, "enabled", e.target.checked)}
                  />
                  <input
                    type="text"
                    value={item.key}
                    onChange={(e) => updateHeaderItem(item.id, "key", e.target.value)}
                    placeholder="Header name"
                  />
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) => updateHeaderItem(item.id, "value", e.target.value)}
                    placeholder="Value"
                  />
                  <button onClick={() => removeHeaderItem(item.id)}>×</button>
                </div>
              ))}
            </div>
            <button className="add-header-button" onClick={addHeaderRow}>
              + Add Header
            </button>
          </div>

          {/* Body Tab Content */}
          <div className={activeTab === "body" ? "" : "hidden"}>
            <div className="body-tabs">
              <button 
                className={`body-tab-button ${bodyMode === "none" ? "active" : ""}`}
                onClick={() => setBodyMode("none")}
              >
                none
              </button>
              <button 
                className={`body-tab-button ${bodyMode === "form-data" ? "active" : ""}`}
                onClick={() => setBodyMode("form-data")}
              >
                form-data
              </button>
              <button 
                className={`body-tab-button ${bodyMode === "urlencoded" ? "active" : ""}`}
                onClick={() => setBodyMode("urlencoded")}
              >
                x-www-form-urlencoded
              </button>
              <button 
                className={`body-tab-button ${bodyMode === "raw" ? "active" : ""}`}
                onClick={() => setBodyMode("raw")}
              >
                raw
              </button>
              <button 
                className={`body-tab-button ${bodyMode === "binary" ? "active" : ""}`}
                onClick={() => setBodyMode("binary")}
              >
                binary
              </button>
              <button 
                className={`body-tab-button ${bodyMode === "graphql" ? "active" : ""}`}
                onClick={() => setBodyMode("graphql")}
              >
                GraphQL
              </button>
            </div>

            {/* Body content based on selected mode */}
            {bodyMode === "none" && (
              <div className="body-none-message">
                This request does not have a body
              </div>
            )}

            {bodyMode === "form-data" && (
              <div className="form-data-container">
                {formDataItems.map(item => (
                  <div key={item.id} className="form-data-row">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => updateFormDataItem(item.id, "enabled", e.target.checked)}
                    />
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) => updateFormDataItem(item.id, "key", e.target.value)}
                      placeholder="Key"
                    />
                    <select
                      className="form-data-type"
                      value={item.type}
                      onChange={(e) => updateFormDataItem(item.id, "type", e.target.value)}
                    >
                      <option value="text">Text</option>
                      <option value="file">File</option>
                    </select>
                    {item.type === "text" ? (
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => updateFormDataItem(item.id, "value", e.target.value)}
                        placeholder="Value"
                      />
                    ) : (
                      <div className="file-input-wrapper">
                        <button>Select File</button>
                        <input
                          type="file"
                          className="file-input"
                          onChange={(e) => updateFormDataItem(
                            item.id, 
                            "file", 
                            e.target.files ? e.target.files[0] : null
                          )}
                        />
                      </div>
                    )}
                    <button onClick={() => removeFormDataItem(item.id)}>×</button>
                  </div>
                ))}
                <button onClick={addFormDataRow}>+ Add</button>
              </div>
            )}

            {bodyMode === "urlencoded" && (
              <div className="form-data-container">
                {formDataItems.map(item => (
                  <div key={item.id} className="form-data-row">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => updateFormDataItem(item.id, "enabled", e.target.checked)}
                    />
                    <input
                      type="text"
                      value={item.key}
                      onChange={(e) => updateFormDataItem(item.id, "key", e.target.value)}
                      placeholder="Key"
                    />
                    <input
                      type="text"
                      value={item.value}
                      onChange={(e) => updateFormDataItem(item.id, "value", e.target.value)}
                      placeholder="Value"
                    />
                    <button onClick={() => removeFormDataItem(item.id)}>×</button>
                  </div>
                ))}
                <button onClick={addFormDataRow}>+ Add</button>
              </div>
            )}

            {bodyMode === "raw" && (
              <>
                <select
                  className="content-type-selector"
                  value={rawContentType}
                  onChange={(e) => setRawContentType(e.target.value as RawContentType)}
                >
                  <option value="text/plain">Text</option>
                  <option value="application/json">JSON</option>
                  <option value="application/xml">XML</option>
                  <option value="text/html">HTML</option>
                  <option value="application/javascript">JavaScript</option>
                </select>
                <textarea
                  className="code-editor"
                  value={rawBody}
                  onChange={(e) => setRawBody(e.target.value)}
                  placeholder={rawContentType === "application/json" ? `{
  "key": "value"
}` : "Enter raw body content"}
                ></textarea>
              </>
            )}

            {bodyMode === "binary" && (
              <div className="binary-container">
                <input
                  type="file"
                  onChange={(e) => setBinaryFile(e.target.files ? e.target.files[0] : null)}
                />
                {binaryFile && (
                  <div className="selected-file">
                    Selected: {binaryFile.name} ({Math.round(binaryFile.size / 1024)} KB)
                  </div>
                )}
              </div>
            )}

            {bodyMode === "graphql" && (
              <div className="graphql-container">
                <h4>Query</h4>
                <textarea
                  className="code-editor"
                  value={graphqlQuery}
                  onChange={(e) => setGraphqlQuery(e.target.value)}
                  placeholder="query { example }"
                ></textarea>
                
                <h4>Variables</h4>
                <textarea
                  className="code-editor"
                  value={graphqlVariables}
                  onChange={(e) => setGraphqlVariables(e.target.value)}
                  placeholder={`{
  "variable": "value"
}`}
                ></textarea>
              </div>
            )}
          </div>
        </section>

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
      </main>
    </div>
  );
}

export default App;
