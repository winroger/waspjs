import React from 'react';

type InfoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  setName?: string;
  description?: string;
  author?: string;
  tags?: string[];
  license?: string;
  units?: string;
  version?: string;
  created?: string;
};

export function InfoModal({
  isOpen,
  onClose,
  title,
  setName,
  description,
  author,
  tags,
  license,
  units,
  version,
  created,
}: InfoModalProps) {
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
        <h2 id="infoModalTitle" className="modal__title">{title}</h2>
        <dl className="modal__meta">
          {setName ? (
            <div>
              <dt>Set</dt>
              <dd id="infoModalSet">{setName}</dd>
            </div>
          ) : null}
          {description ? (
            <div>
              <dt>Description</dt>
              <dd id="infoModalDesc">{description}</dd>
            </div>
          ) : null}
          {author ? (
            <div>
              <dt>Author</dt>
              <dd id="infoModalAuthor">{author}</dd>
            </div>
          ) : null}
          {tags && tags.length > 0 ? (
            <div>
              <dt>Tags</dt>
              <dd>
                <div className="modal__tags">
                  {tags.map((tag) => (
                    <span key={tag} className="modal__tag">{tag}</span>
                  ))}
                </div>
              </dd>
            </div>
          ) : null}
          {license ? (
            <div>
              <dt>License</dt>
              <dd>{license}</dd>
            </div>
          ) : null}
          {units ? (
            <div>
              <dt>Units</dt>
              <dd>{units}</dd>
            </div>
          ) : null}
          {version ? (
            <div>
              <dt>Version</dt>
              <dd>{version}</dd>
            </div>
          ) : null}
          {created ? (
            <div>
              <dt>Created</dt>
              <dd>{created}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
