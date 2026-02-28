"use client"

import { useState, useEffect } from "react"
import Preloader from "@/components/Preloader"

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  // Default to true so children render immediately on subsequent visits
  // (no flash of hidden content while sessionStorage is being checked)
  const [loaded, setLoaded] = useState(true)

  useEffect(() => {
    // Only show the preloader once per browser sessions
    const alreadySeen = sessionStorage.getItem("unimart_preloader_done")
    if (!alreadySeen) {
      // First visit this session — show the preloader
      setLoaded(false)
    }
  }, [])

  const handleComplete = () => {
    sessionStorage.setItem("unimart_preloader_done", "1")
    setLoaded(true)
  }

  return (
    <>
      {!loaded && (
        <Preloader onComplete={handleComplete} duration={2200} />
      )}
      <div
        style={{
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.5s ease 0.1s",
          overflow: loaded ? "visible" : "hidden",
          height: loaded ? "auto" : "100vh",
        }}
      >
        {children}
      </div>
    </>
  )
}