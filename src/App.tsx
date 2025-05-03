import { useState, useEffect } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from 'uuid';
import Modal  from "./components/Modal"; // Assuming a Modal component exists

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

// Define types for Jet and Action
interface Jet {
  id: string;
  name?: string;
  method: string;
  url: string;
  headers: string[];
  body?: string;
}

type Action = "delete" | "clone" | "rename";

function CurlWindow({ curlCommand, onClose }: { curlCommand: string; onClose: () => void }) {
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
}

function App() {
  // Update state types
  const [tabs, setTabs] = useState<Jet[]>([{ id: "1", method: "GET", url: "", headers: [], body: "" }]);
  const [activeTabId, setActiveTabId] = useState<string>("1");
  const [collections, setCollections] = useState<Jet[]>([]);
  const [isCollectionExpanded, setIsCollectionExpanded] = useState(true);
  const [isCurlWindowOpen, setCurlWindowOpen] = useState(false);
  const [curlCommand, setCurlCommand] = useState("");
  const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<{ version: number; data: string; timestamp: string }[]>([]);
  const [selectedJetId, setSelectedJetId] = useState<string | null>(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const jets = await invoke("get_jets_command") as Jet[];
      console.log("Fetched collections:", jets);
      setCollections(jets);
    } catch (error) {
      console.error("Failed to fetch collections:", error);
    }
  };

  const addNewTab = () => {
    const newId = uuidv4();
    setTabs([...tabs, { id: newId, method: "GET", url: "", headers: [], body: "", name: "" }]);
    setActiveTabId(newId);
  };

  // Fix selectJetFromCollection function
  const selectJetFromCollection = (jet: Jet) => {
    const existingTab = tabs.find(tab => tab.id === jet.id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      setTabs([...tabs, jet]);
      setActiveTabId(jet.id);
    }

    // Update headerItems state with the headers of the selected Jet
    setHeaderItems(
      jet.headers.map((header, index) => {
        const [key, value] = header.split(": ");
        return { id: index + 1, enabled: true, key: key || "", value: value || "" };
      })
    );
  };

  // Ensure the delete_jet_command is properly invoked in the frontend
  const handleJetAction = async (action: Action, jet: Jet) => {
    switch (action) {
      case "delete":
        try {
          await invoke("delete_jet_command", { jetId: jet.id }); // Call the Tauri command to delete from the database
          setCollections(collections.filter(j => j.id !== jet.id)); // Update the UI after successful deletion
        } catch (error) {
          console.error("Failed to delete jet:", error);
          alert("Failed to delete jet.");
        }
        break;
      case "clone":
        const clonedJet: Jet = { ...jet, id: uuidv4(), name: `${jet.name || jet.url} (Copy)` };
        setCollections([...collections, clonedJet]);
        break;
      case "rename":
        const newName = prompt("Enter new name for the jet:", jet.name || jet.url);
        if (newName) {
          try {
            await invoke("rename_jet_command", { jetId: jet.id, newName }); // Call the Tauri command to rename in the database
            setCollections(collections.map(j => j.id === jet.id ? { ...j, name: newName } : j)); // Update the UI after successful renaming
          } catch (error) {
            console.error("Failed to rename jet:", error);
            alert("Failed to rename jet.");
          }
        }
        break;
      default:
        break;
    }
  };

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

  // Update the toggleCollection function to fetch collections when expanded
  const toggleCollection = () => {
    if (!isCollectionExpanded) {
      fetchCollections(); // Fetch collections when expanding
    }
    setIsCollectionExpanded(!isCollectionExpanded);
  };

  // Create headers string from header items
  const getHeadersString = () => {
    return headerItems
      .filter(item => item.enabled && item.key.trim() !== "")
      .map(item => `${item.key}: ${item.value}`)
      .join("\n");
  };

  // Create body based on selected mode
  const getBodyContent = (method: string) => {
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

      const activeTab = tabs.find(tab => tab.id === activeTabId);
      if (!activeTab) throw new Error("No active tab found");

      const response = await invoke("run_curl", {
        method: activeTab.method,
        url: activeTab.url,
        headers: headersArray,
        body: getBodyContent(activeTab.method),
      });

      const endTime = performance.now();

      console.log("Backend Response:", response); // Debugging log

      // Save the current state of the Jet to history
      await invoke("save_jet_history_command", {
        jet: {
          id: activeTab.id,
          name: activeTab.name,
          method: activeTab.method,
          url: activeTab.url,
          headers: headersArray,
          body: getBodyContent(activeTab.method),
        },
      });

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

  // Fix saveJet function
  const saveJet = async () => {
    try {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      if (!activeTab) throw new Error("No active tab found");

      await invoke("save_jet_command", {
        method: activeTab.method,
        url: activeTab.url,
        headers: activeTab.headers,
        body: getBodyContent(activeTab.method),
      });
      alert("Jet saved successfully!");
    } catch (error) {
      console.error("Failed to save jet:", error);
      alert("Failed to save jet.");
    }
  };

  // Fix closeTab function
  const closeTab = (id: string) => {
    setTabs((prevTabs) => {
      const updatedTabs = prevTabs.filter((tab) => tab.id !== id);
      if (activeTabId === id && updatedTabs.length > 0) {
        setActiveTabId(updatedTabs[0].id);
      } else if (updatedTabs.length === 0) {
        setActiveTabId("1"); // Default to the first tab
      }
      return updatedTabs;
    });
  };

  // Function to generate cURL command
  const generateCurlCommand = () => {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    if (!activeTab) return "";

    const headers = headerItems
      .filter(item => item.enabled && item.key.trim() !== "")
      .map(item => `-H \"${item.key}: ${item.value}\"`)
      .join(" ");

    const body = getBodyContent(activeTab.method);
    const bodyOption = body ? `-d \"${body.replace(/"/g, '\\\"')}\"` : "";

    return `curl -X ${activeTab.method} \"${activeTab.url}\" ${headers} ${bodyOption}`.trim();
  };

  const fetchJetHistory = async (jetId: string) => {
    console.log(`Fetching history for jetId: ${jetId}`);
    try {
        // Get history data from backend
        const historyTuples = await invoke<[number, string, string][]>("fetch_jet_history_command", { jetId });
        console.log("Raw history data:", historyTuples);
        
        // Convert tuple array to object array
        const formattedHistory = historyTuples.map(tuple => ({
            version: tuple[0],
            data: tuple[1],
            timestamp: tuple[2]
        }));
        
        console.log("Formatted history:", formattedHistory);
        setHistoryData(formattedHistory);
        setSelectedJetId(jetId);
        setHistoryModalOpen(true);
    } catch (error) {
        console.error("Failed to fetch history:", error);
        alert("Failed to fetch history.");
    }
};

  const revertToVersion = async (version: number) => {
    if (!selectedJetId) return;
    try {
      await invoke("revert_jet_to_version", { jetId: selectedJetId, version });
      alert("Reverted to version " + version);
      setHistoryModalOpen(false);
      fetchCollections(); // Refresh collections after revert
    } catch (error) {
      console.error("Failed to revert to version:", error);
      alert("Failed to revert to version.");
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="app-branding" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: 'black', fontWeight: 'bold' }}>
          <img src="/jetraay.png" alt="Jetraay Logo" className="app-logo" />
          <span className="app-name">Jetraay</span>
        </div>
        <div className="button-group" style={{ display: 'flex', flexDirection: 'row', gap: '10px', marginTop: '10px', justifyContent: 'center' }}>
          <button className="new-jet-button" onClick={addNewTab}>+ New Jet</button>
          <button className="import-button">Import</button>
        </div>

        <div className="sidebar-section">
          <h3 className="sidebar-title" onClick={toggleCollection}>
            Collections {isCollectionExpanded ? "▼" : "▶"}
          </h3>
          {isCollectionExpanded && (
            <ul className="collection-list">
              {collections.map((jet, index) => (
                <li key={index} className="collection-item">
                  <span onClick={() => selectJetFromCollection(jet)}>
                    {jet.name || jet.url}
                  </span>
                  <div className="jet-actions">
                    <div className="dropdown">
                      <button className="dropdown-toggle">⋮</button>
                      <div className="dropdown-menu">
                        <button onClick={() => handleJetAction('delete', jet)}>Delete</button>
                        <button onClick={() => handleJetAction('clone', jet)}>Clone</button>
                        <button onClick={() => handleJetAction('rename', jet)}>Rename</button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sidebar-section">
          <h3 className="sidebar-title">History</h3>
        </div>
        
        <div className="sidebar-section">
          <h3 className="sidebar-title">Environments</h3>
        </div>
      </aside>

      <main className="main-content">
        <div className="tab-system">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab ${tab.id === activeTabId ? "active" : ""}`}
            >
              <span onClick={() => setActiveTabId(tab.id)}>{tab.url || "New Jet"}</span>
              <button className="close-tab-button" onClick={() => closeTab(tab.id)}>×</button>
            </div>
          ))}
        </div>

        <section className="request-section">
          {tabs.map((tab) => (
            tab.id === activeTabId && (
              <div key={tab.id}>
                <header className="top-toolbar">
                  <input
                    className="api-name-input"
                    type="text"
                    value={tab.url}
                    onChange={(e) => {
                      setTabs(tabs.map(t => t.id === tab.id ? { ...t, url: e.target.value } : t));
                    }}
                    placeholder="API Name"
                  />
                  <div className="action-buttons">
                    <button className="save-button" onClick={saveJet}>Save</button>
                    <button className="share-button">Share</button>
                    <button
                      className="share-button"
                      onClick={() => {
                        setCurlCommand(generateCurlCommand());
                        setCurlWindowOpen(true);
                      }}
                    >
                      cURL
                    </button>
                    <button
                      className="history-button"
                      onClick={() => fetchJetHistory(tab.id)}
                    >
                      History
                    </button>
                  </div>
                </header>

                <header className="top-toolbar">
                  <select
                    className="method-selector"
                    value={tab.method}
                    onChange={(e) => {
                      setTabs(tabs.map(t => t.id === tab.id ? { ...t, method: e.target.value } : t));
                    }}
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
                    value={tab.url}
                    onChange={(e) => {
                      setTabs(tabs.map(t => t.id === tab.id ? { ...t, url: e.target.value } : t));
                    }}
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
              </div>
            )
          ))}
        </section>
      </main>
      {isCurlWindowOpen && (
        <CurlWindow
          curlCommand={curlCommand}
          onClose={() => setCurlWindowOpen(false)}
        />
      )}
      {isHistoryModalOpen && (
        <Modal onClose={() => setHistoryModalOpen(false)}>
          <div className="history-modal">
            <h2>History</h2>
            <ul>
              {historyData.map(({ version, data, timestamp }) => (
                <li key={version}>
                  <p>Version: {version}</p>
                  <p>Timestamp: {timestamp}</p>
                  <pre>{data}</pre>
                  <button onClick={() => revertToVersion(version)}>Revert</button>
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default App;
