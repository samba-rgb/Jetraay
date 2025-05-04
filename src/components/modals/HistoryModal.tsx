import React from "react";
import Modal from "../Modal";

interface HistoryItem {
  version: number;
  data: string;
  timestamp: string;
}

interface HistoryModalProps {
  historyData: HistoryItem[];
  onClose: () => void;
  onRevertToVersion: (version: number) => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  historyData,
  onClose,
  onRevertToVersion,
}) => {
  return (
    <Modal onClose={onClose}>
      <div className="history-modal">
        <h2>History</h2>
        <ul>
          {historyData.map(({ version, data, timestamp }) => (
            <li key={version}>
              <p>Version: {version}</p>
              <p>Timestamp: {timestamp}</p>
              <pre>{data}</pre>
              <button onClick={() => onRevertToVersion(version)}>Revert</button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
};

export default HistoryModal;