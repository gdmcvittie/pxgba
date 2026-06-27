import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PxShop from './PxShop.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PxShop />
  </StrictMode>,
)
