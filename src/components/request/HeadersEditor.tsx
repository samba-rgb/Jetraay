import React from "react";
import { HeaderItem } from "../../types";

interface HeadersEditorProps {
  headerItems: HeaderItem[];
  updateHeaderItem: (id: number, field: keyof HeaderItem, value: any) => void;
  removeHeaderItem: (id: number) => void;
  addHeaderRow: () => void;
}

const HeadersEditor: React.FC<HeadersEditorProps> = ({
  headerItems,
  updateHeaderItem,
  removeHeaderItem,
  addHeaderRow,
}) => {
  return (
    <div>
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
  );
};

export default HeadersEditor;