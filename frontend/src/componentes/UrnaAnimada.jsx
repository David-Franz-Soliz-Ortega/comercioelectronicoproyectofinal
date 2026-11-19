import React from 'react';

// La papeleta queda detrás del frente de la urna al entrar por la ranura.
export default function UrnaAnimada({ compacta = false }) {
  return <div className={`escena-urna ${compacta ? 'urna-compacta' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 320 270" fill="none">
      <ellipse className="sombra-urna" cx="166" cy="246" rx="98" ry="13" fill="#071225" opacity=".18" />
      <path d="m63 125 104-31 99 31-104 34-99-34Z" fill="#E4E9F2" />
      <path d="m113 124 66-20 27 9-66 21-27-10Z" fill="#17243B" />
      <g className="papeleta-animada">
        <rect x="137" y="25" width="67" height="83" rx="5" transform="rotate(16 137 25)" fill="#fff" />
        <path d="m151 45 29 8m-32 3 29 8" stroke="#C7CFDC" strokeWidth="3" strokeLinecap="round" />
        <path d="m145 74 7 12 20-14" stroke="#BB344B" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <path d="m63 125 99 34v88l-99-35v-87Z" fill="#FAFBFD" />
      <path d="m162 159 104-34v87l-104 35v-88Z" fill="#D6DFEE" />
      <path d="m63 125 99 34 104-34" stroke="#fff" strokeWidth="2" />
      <path d="m162 159 104-34v12l-104 34v-12Z" fill="#BAC9DF" />
      <path d="m63 125 99 34v12l-99-34v-12Z" fill="#E4E9F2" />
      <path d="m94 162 36 12v40l-36-13v-39Z" fill="#BB344B" />
      <path d="m102 183 7 9 14-13" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m192 183 42-14m-42 24 30-10" stroke="#A6B5CA" strokeWidth="3" strokeLinecap="round" />
      <g className="destello-urna" stroke="#D99D68" strokeWidth="2.5" strokeLinecap="round">
        <path d="M248 61v12m-6-6h12M72 77v8m-4-4h8" />
      </g>
    </svg>
  </div>;
}
