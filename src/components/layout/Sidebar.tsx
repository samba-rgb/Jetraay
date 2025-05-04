import React from "react";
import { Jet, Action } from "../../types";

interface SidebarProps {
  collections: Jet[];
  isCollectionExpanded: boolean;
  toggleCollection: () => void;
  addNewTab: () => void;
  selectJetFromCollection: (jet: Jet) => void;
  handleJetAction: (action: Action, jet: Jet) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  collections,
  isCollectionExpanded,
  toggleCollection,
  addNewTab,
  selectJetFromCollection,
  handleJetAction,
}) => {
  return (
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
  );
};

export default Sidebar;