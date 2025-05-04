import React, { useState } from 'react';
import HeadersEditor from './HeadersEditor';
import BodyEditor from './BodyEditor';
import { HeaderItem, FormDataItem, BodyMode, RawContentType, Jet } from '../../types';

interface RequestPanelProps {
  activeTab: Jet;
  updateTabUrl: (id: string, url: string) => void;
  updateTabMethod: (id: string, method: string) => void;
  saveJet: () => void;
  generateCurlCommand: () => string;
  setCurlCommand: (command: string) => void;
  setCurlWindowOpen: (isOpen: boolean) => void;
  fetchJetHistory: (jetId: string) => void;
  sendRequest: () => void;
  
  // Header state and handlers
  headerItems: HeaderItem[];
  updateHeaderItem: (id: number, field: keyof HeaderItem, value: any) => void;
  removeHeaderItem: (id: number) => void;
  addHeaderRow: () => void;
  
  // Body state and handlers
  bodyMode: BodyMode;
  setBodyMode: (mode: BodyMode) => void;
  rawContentType: RawContentType;
  setRawContentType: (contentType: RawContentType) => void;
  rawBody: string;
  setRawBody: (body: string) => void;
  formDataItems: FormDataItem[];
  updateFormDataItem: (id: number, field: keyof FormDataItem, value: any) => void;
  removeFormDataItem: (id: number) => void;
  addFormDataRow: () => void;
  binaryFile: File | null;
  setBinaryFile: (file: File | null) => void;
  graphqlQuery: string;
  setGraphqlQuery: (query: string) => void;
  graphqlVariables: string;
  setGraphqlVariables: (variables: string) => void;
}

const RequestPanel: React.FC<RequestPanelProps> = ({
  activeTab,
  updateTabUrl,
  updateTabMethod,
  saveJet,
  generateCurlCommand,
  setCurlCommand,
  setCurlWindowOpen,
  fetchJetHistory,
  sendRequest,
  
  // Headers props
  headerItems,
  updateHeaderItem,
  removeHeaderItem,
  addHeaderRow,
  
  // Body props
  bodyMode,
  setBodyMode,
  rawContentType, 
  setRawContentType,
  rawBody,
  setRawBody,
  formDataItems,
  updateFormDataItem,
  removeFormDataItem,
  addFormDataRow,
  binaryFile,
  setBinaryFile,
  graphqlQuery,
  setGraphqlQuery,
  graphqlVariables,
  setGraphqlVariables
}) => {
  const [activeTabType, setActiveTabType] = useState<"headers" | "body">("headers");
  
  return (
    <section className="request-section">
      <header className="top-toolbar">
        <input
          className="api-name-input"
          type="text"
          value={activeTab.url}
          onChange={(e) => {
            updateTabUrl(activeTab.id, e.target.value);
          }}
          placeholder="API Name"
        />
        <div className="action-buttons">
          <button className="save-button" onClick={saveJet}>Save</button>
          <button className="share-button">Share</button>
          <button
            className="share-button"
            onClick={() => {
              const curlCommand = generateCurlCommand();
              setCurlCommand(curlCommand);
              setCurlWindowOpen(true);
            }}
          >
            cURL
          </button>
          <button
            className="history-button"
            onClick={() => fetchJetHistory(activeTab.id)}
          >
            History
          </button>
        </div>
      </header>

      <header className="top-toolbar">
        <select
          className="method-selector"
          value={activeTab.method}
          onChange={(e) => {
            updateTabMethod(activeTab.id, e.target.value);
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
          value={activeTab.url}
          onChange={(e) => {
            updateTabUrl(activeTab.id, e.target.value);
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
            className={`tab-button ${activeTabType === "headers" ? "active" : ""}`}
            onClick={() => setActiveTabType("headers")}
          >
            Headers
          </button>
          <button 
            className={`tab-button ${activeTabType === "body" ? "active" : ""}`}
            onClick={() => setActiveTabType("body")}
          >
            Body
          </button>
        </div>

        {/* Headers Tab Content */}
        <div className={activeTabType === "headers" ? "" : "hidden"}>
          <HeadersEditor
            headerItems={headerItems}
            updateHeaderItem={updateHeaderItem}
            removeHeaderItem={removeHeaderItem}
            addHeaderRow={addHeaderRow}
          />
        </div>

        {/* Body Tab Content */}
        <div className={activeTabType === "body" ? "" : "hidden"}>
          <BodyEditor
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
        </div>
      </section>
    </section>
  );
};

export default RequestPanel;