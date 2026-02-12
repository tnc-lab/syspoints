import { useRef, useState } from "react"

export default function FileUpload({ accept, onFile, disabled = false, multiple = false, buttonText = "Seleccionar imagen", className = "", buttonClass = "ghost-button" }) {
  const inputRef = useRef(null)
  const [name, setName] = useState("")

  const handleClick = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const handleChange = (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    if (multiple) {
      const list = Array.from(files)
      onFile && onFile(list)
      setName(`${list.length} archivos`)
    } else {
      const file = files[0]
      onFile && onFile(file)
      setName(file.name)
    }
    // reset so same file can be selected again
    e.target.value = ""
  }

  return (
    <div className={`file-upload ${className}`} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: "none" }}
        onChange={handleChange}
        disabled={disabled}
      />
      <button type="button" className={buttonClass} onClick={handleClick} disabled={disabled}>
        {buttonText}
      </button>
      <span style={{ fontSize: "0.95rem", color: "#6b7280" }}>{name || "No file selected"}</span>
    </div>
  )
}
