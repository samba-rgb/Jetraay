import React from "react";
import { BodyMode, RawContentType, FormDataItem } from "../../types";

interface BodyEditorProps {
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

const BodyEditor: React.FC<BodyEditorProps> = ({
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
  setGraphqlVariables,
}) => {
  return (
    <div>
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
                onChange={(e) => updateFormDataItem(item.id, "type", e.target.value as 'text' | 'file')}
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
  );
};

export default BodyEditor;