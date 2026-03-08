"use client"

import { useState } from "react"
import { CountrySelect, StateSelect, CitySelect } from "react-country-state-city"
import "react-country-state-city/dist/react-country-state-city.css"

type CountryItem = { id: number; name: string }
type StateItem = { id: number; name: string }
type CityItem = { id: number; name: string; latitude?: string; longitude?: string }

export type LocationComponents = {
  city?: string
  state?: string
  country?: string
  lat?: number
  lng?: number
}

type LocationPickerProps = {
  value?: string
  onChange: (value: string, components?: LocationComponents) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  error?: string
}

function buildLocationString(city?: string, state?: string, country?: string): string {
  const parts = [city, state, country].filter(Boolean)
  return parts.join(", ") || ""
}

export function LocationPicker({
  onChange,
  placeholder,
  disabled,
  className = "",
  error,
}: LocationPickerProps) {
  const [countryId, setCountryId] = useState(0)
  const [stateId, setStateId] = useState(0)
  const [countryName, setCountryName] = useState("")
  const [stateName, setStateName] = useState("")

  const handleCountryChange = (c: CountryItem) => {
    setCountryId(c.id)
    setCountryName(c.name)
    setStateId(0)
    setStateName("")
    onChange(buildLocationString(undefined, undefined, c.name), { country: c.name })
  }

  const handleStateChange = (s: StateItem) => {
    setStateId(s.id)
    setStateName(s.name)
    onChange(buildLocationString(undefined, s.name, countryName), {
      state: s.name,
      country: countryName,
    })
  }

  const handleCityChange = (c: CityItem) => {
    const location = buildLocationString(c.name, stateName, countryName)
    const lat = c.latitude ? parseFloat(c.latitude) : undefined
    const lng = c.longitude ? parseFloat(c.longitude) : undefined
    onChange(location, {
      city: c.name,
      state: stateName || undefined,
      country: countryName,
      lat,
      lng,
    })
  }

  const isSelection = (e: unknown): e is { id: number; name: string } =>
    typeof e === "object" && e !== null && "id" in e && "name" in e

  return (
    <div className={`space-y-3 ${className} [&_.stdropdown-menu]:!z-50`}>
      <CountrySelect
        placeHolder={placeholder ?? "Select country"}
        onChange={(e) => isSelection(e) && handleCountryChange(e)}
        containerClassName="!w-full !relative"
        inputClassName="!w-full !px-4 !py-2 !border !border-gray-300 !rounded-lg focus:!ring-2 focus:!ring-zinc-900"
        showFlag={false}
      />
      {countryId > 0 && (
        <StateSelect
          countryid={countryId}
          placeHolder="Select state / region"
          onChange={(e) => isSelection(e) && handleStateChange(e)}
          containerClassName="!w-full"
          inputClassName="!w-full !px-4 !py-2 !border !border-gray-300 !rounded-lg focus:!ring-2 focus:!ring-zinc-900"
        />
      )}
      {countryId > 0 && stateId > 0 && (
        <CitySelect
          countryid={countryId}
          stateid={stateId}
          placeHolder="Select city"
          onChange={(e) => isSelection(e) && handleCityChange(e as CityItem)}
          containerClassName="!w-full"
          inputClassName="!w-full !px-4 !py-2 !border !border-gray-300 !rounded-lg focus:!ring-2 focus:!ring-zinc-900"
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
