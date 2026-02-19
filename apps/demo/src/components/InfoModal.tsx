import React from 'react';

type InfoModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function InfoModal({ isOpen, onClose }: InfoModalProps) {
  return (
    <div
      id="infoModal"
      className={`modal${isOpen ? ' is-open' : ''}`}
      aria-modal="true"
      role="dialog"
      aria-labelledby="infoModalTitle"
      aria-describedby="infoModalDesc"
    >
      <div className="modal__backdrop" onClick={onClose}></div>
      <div className="modal__content">
        <button className="modal__close" id="infoModalClose" aria-label="Close info" onClick={onClose}>
          ×
        </button>
        <h2 id="infoModalTitle" className="modal__title"></h2>
        <dl className="modal__meta">
          <div>
            <dt>Set</dt>
            <dd id="infoModalSet"></dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd id="infoModalDesc"></dd>
          </div>
          <div>
            <dt>Author</dt>
            <dd id="infoModalAuthor"></dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
