import { useState, useEffect } from "react";
import "./App.css";
import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from 'uuid';

// Import types
import { 
  HeaderItem, FormDataItem, BodyMode, RawContentType, 
  ResponseTab, ResponseFormat, Jet, Action 
} from "./types";

// Import components
import Sidebar from "./components/layout/Sidebar";
import RequestPanel from "./components/request/RequestPanel";
import ResponsePanel from "./components/response/ResponsePanel";
import CurlWindow from "./components/modals/CurlWindow";
import HistoryModal from "./components/modals/HistoryModal";

function App() {
  // Tab management state
  const [tabs, setTabs] = useState<Jet[]>([{ id: "1", method: "GET", url: "", headers: [], body: "" }]);
  const [activeTabId, setActiveTabId] = useState<string>("1");
  
  // Collections state
  const [collections, setCollections] = useState<Jet[]>([]);
  const [isCollectionExpanded, setIsCollectionExpanded] = useState(true);
  
  // Modal state
  const [isCurlWindowOpen, setCurlWindowOpen] = useState(false);
  const [curlCommand, setCurlCommand] = useState("");
  const [isHistoryModalOpen, setHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState<{ version: number; data: string; timestamp: string }[]>([]);
  const [selectedJetId, setSelectedJetId] = useState<string | null>(null);

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

  const handleJetAction = async (action: Action, jet: Jet) => {
    switch (action) {
      case "delete":
        try {
          await invoke("delete_jet_command", { jetId: jet.id });
          setCollections(collections.filter(j => j.id !== jet.id));
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
            await invoke("rename_jet_command", { jetId: jet.id, newName });
            setCollections(collections.map(j => j.id === jet.id ? { ...j, name: newName } : j));
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

  const toggleCollection = () => {
    if (!isCollectionExpanded) {
      fetchCollections();
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
      console.log("🚀 Request initiated");

      const headersArray = headerItems
        .filter(item => item.enabled && item.key.trim() !== "")
        .map(item => `${item.key}: ${item.value}`);

      console.log("📋 Headers prepared:", headersArray);

      // Add content type header if using raw mode
      if (bodyMode === "raw" && !headersArray.some(h => h.toLowerCase().startsWith("content-type:"))) {
        headersArray.push(`Content-Type: ${rawContentType}`);
        console.log("➕ Added Content-Type header for raw body:", rawContentType);
      }

      // Add content type for GraphQL
      if (bodyMode === "graphql" && !headersArray.some(h => h.toLowerCase().startsWith("content-type:"))) {
        headersArray.push("Content-Type: application/json");
        console.log("➕ Added Content-Type header for GraphQL");
      }

      const activeTab = tabs.find(tab => tab.id === activeTabId);
      if (!activeTab) throw new Error("No active tab found");

      console.log(`📤 Sending ${activeTab.method} request to ${activeTab.url}`);
      const bodyContent = getBodyContent(activeTab.method);
      if (bodyContent) {
        console.log(`📦 Request body (${bodyMode} mode):`, 
          bodyContent.length > 500 ? bodyContent.substring(0, 500) + "... (truncated)" : bodyContent);
      }

      const response = await invoke("run_curl", {
        method: activeTab.method,
        url: activeTab.url,
        headers: headersArray,
        body: getBodyContent(activeTab.method),
      });

      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);
      console.log(`✅ Response received in ${responseTime}ms`);

      console.log("📥 Backend Response:", 
        String(response).length > 500 ? String(response).substring(0, 500) + "... (truncated)" : response);

      // Save the current state of the Jet to history
      console.log("💾 Saving request to history...");
      const jetToSave = {
        id: activeTab.id,
        name: activeTab.name,
        method: activeTab.method,
        url: activeTab.url,
        headers: headersArray,
        body: getBodyContent(activeTab.method),
      };
      
      await invoke("save_jet_history_command", { jet: jetToSave })
        .then(() => console.log("✅ History saved successfully for jet ID:", activeTab.id))
        .catch(err => console.error("❌ Failed to save history:", err));

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
      console.error("❌ Error invoking backend:", error);
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

  const closeTab = (id: string) => {
    setTabs((prevTabs) => {
      const updatedTabs = prevTabs.filter((tab) => tab.id !== id);
      if (activeTabId === id && updatedTabs.length > 0) {
        setActiveTabId(updatedTabs[0].id);
      } else if (updatedTabs.length === 0) {
        setActiveTabId("1");
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
    console.log(`📜 Fetching history for jetId: ${jetId}`);
    try {
      console.time('History fetch duration');
      const historyTuples = await invoke<[number, string, string][]>("fetch_jet_history_command", { jetId });
      console.timeEnd('History fetch duration');
      
      console.log(`📊 Retrieved ${historyTuples.length} history entries for jetId: ${jetId}`);
      console.log("📝 Raw history data:", historyTuples);
      
      const formattedHistory = historyTuples.map(tuple => ({
        version: tuple[0],
        data: tuple[1],
        timestamp: tuple[2]
      }));
      
      console.log("🔄 Formatted history data:", formattedHistory);
      setHistoryData(formattedHistory);
      setSelectedJetId(jetId);
      setHistoryModalOpen(true);
    } catch (error) {
      console.error("❌ Failed to fetch history:", error);
      alert("Failed to fetch history.");
    }
  };

  const revertToVersion = async (version: number) => {
    if (!selectedJetId) {
      console.error("❌ Cannot revert: No jet selected");
      return;
    }
    
    console.log(`🔄 Reverting jet ${selectedJetId} to version ${version}`);
    try {
      console.time('Revert operation');
      await invoke("revert_jet_to_version_command", { jetId: selectedJetId, version });
      console.timeEnd('Revert operation');
      
      console.log(`✅ Successfully reverted jet ${selectedJetId} to version ${version}`);
      
      // Get the reverted data from the history to update the UI
      const revertedJetData = historyData.find(item => item.version === version);
      if (revertedJetData) {
        // Parse the data and update the current tab
        try {
          const jetData = JSON.parse(revertedJetData.data);
          
          // Update tabs state with the reverted data
          setTabs(tabs.map(tab => 
            tab.id === selectedJetId ? 
            { 
              ...tab, 
              method: jetData.method,
              url: jetData.url,
              headers: jetData.headers,
              body: jetData.body,
              name: jetData.name 
            } : tab
          ));
          
          // If the jet we're reverting is the active tab, update the header items too
          if (selectedJetId === activeTabId) {
            setHeaderItems(
              jetData.headers.map((header: string, index: number): HeaderItem => {
              const [key, value] = header.split(": ");
              return { id: index + 1, enabled: true, key: key || "", value: value || "" };
              })
            );
            
            // If there's a body and it's in "raw" mode, update the rawBody state
            if (jetData.body) {
              setRawBody(jetData.body);
            }
          }
        } catch (parseError) {
          console.error("❌ Failed to parse reverted jet data:", parseError);
        }
      }
      
      alert("Reverted to version " + version);
      setHistoryModalOpen(false);
      
      console.log("🔄 Refreshing collections after revert");
      fetchCollections();
    } catch (error) {
      console.error(`❌ Failed to revert jet ${selectedJetId} to version ${version}:`, error);
      alert("Failed to revert to version.");
    }
  };

  // Helper functions for the RequestPanel component
  const updateTabUrl = (id: string, url: string) => {
    setTabs(tabs.map(tab => tab.id === id ? { ...tab, url } : tab));
  };

  const updateTabMethod = (id: string, method: string) => {
    setTabs(tabs.map(tab => tab.id === id ? { ...tab, method } : tab));
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];

  return (
    <div className="app-container">
      {/* Sidebar Component */}
      <Sidebar
        collections={collections}
        isCollectionExpanded={isCollectionExpanded}
        toggleCollection={toggleCollection}
        addNewTab={addNewTab}
        selectJetFromCollection={selectJetFromCollection}
        handleJetAction={handleJetAction}
      />

      <main className="main-content">
        {/* Tabs Navigation */}
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

        {/* Main Content Area */}
        <RequestPanel
          activeTab={activeTab}
          updateTabUrl={updateTabUrl}
          updateTabMethod={updateTabMethod}
          saveJet={saveJet}
          generateCurlCommand={generateCurlCommand}
          setCurlCommand={setCurlCommand}
          setCurlWindowOpen={setCurlWindowOpen}
          fetchJetHistory={fetchJetHistory}
          sendRequest={sendRequest}
          
          // Header props
          headerItems={headerItems}
          updateHeaderItem={updateHeaderItem}
          removeHeaderItem={removeHeaderItem}
          addHeaderRow={addHeaderRow}
          
          // Body props
          bodyMode={bodyMode}
          setBodyMode={setBodyMode}
          rawContentType={rawContentType}
          setRawContentType={setRawContentType}
          rawBody={rawBody}
          setRawBody={setRawBody}
          formDataItems={formDataItems}
          updateFormDataItem={updateFormDataItem}
          removeFormDataItem={removeFormDataItem}
          addFormDataRow={addFormDataRow}
          binaryFile={binaryFile}
          setBinaryFile={setBinaryFile}
          graphqlQuery={graphqlQuery}
          setGraphqlQuery={setGraphqlQuery}
          graphqlVariables={graphqlVariables}
          setGraphqlVariables={setGraphqlVariables}
        />

        {/* Response Panel */}
        <ResponsePanel
          response={response}
          responseStatus={responseStatus}
          responseTime={responseTime}
          responseSize={responseSize}
          responseHeaders={responseHeaders}
          responseCookies={responseCookies}
          activeResponseTab={activeResponseTab}
          setActiveResponseTab={setActiveResponseTab}
          responseFormat={responseFormat}
          setResponseFormat={setResponseFormat}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
      </main>

      {/* Modal Components */}
      {isCurlWindowOpen && (
        <CurlWindow
          curlCommand={curlCommand}
          onClose={() => setCurlWindowOpen(false)}
        />
      )}
      
      {isHistoryModalOpen && (
        <HistoryModal
          historyData={historyData}
          onClose={() => setHistoryModalOpen(false)}
          onRevertToVersion={revertToVersion}
        />
      )}
    </div>
  );
}

export default App;
