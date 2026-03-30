"use client"

import { useState } from "react"
import Select from "react-select"
import { Country, State, City } from "country-state-city"

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

type Option = { value: string; label: string }

function buildLocationString(city?: string, state?: string, country?: string): string {
  return [city, state, country].filter(Boolean).join(", ")
}

export function LocationPicker({
  value,
  onChange,
  placeholder,
  disabled,
  className = "",
  error,
}: LocationPickerProps) {
  const [countryCode, setCountryCode] = useState<string | null>(null)
  const [stateCode, setStateCode] = useState<string | null>(null)

  const countryOptions: Option[] = Country.getAllCountries().map((c) => ({
    value: c.isoCode,
    label: c.name,
  }))

  const stateOptions: Option[] = countryCode
    ? State.getStatesOfCountry(countryCode).map((s) => ({
        value: s.isoCode,
        label: s.name,
      }))
    : []

  const cityOptions: Option[] = countryCode && stateCode
    ? City.getCitiesOfState(countryCode, stateCode).map((c) => ({
        value: c.name,
        label: c.name,
      }))
    : []

  const handleCountryChange = (opt: Option | null) => {
    setCountryCode(opt?.value ?? null)
    setStateCode(null)
    if (opt) {
      const country = Country.getCountryByCode(opt.value)
      onChange(opt.label, { country: opt.label })
    } else {
      onChange("", undefined)
    }
  }

  const handleStateChange = (opt: Option | null) => {
    setStateCode(opt?.value ?? null)
    if (countryCode) {
      const country = Country.getCountryByCode(countryCode)
      const location = buildLocationString(undefined, opt?.label, country?.name)
      onChange(location, { state: opt?.label, country: country?.name })
    }
  }

  const handleCityChange = (opt: Option | null) => {
    if (!countryCode) return
    const country = Country.getCountryByCode(countryCode)
    const state = stateCode ? State.getStateByCodeAndCountry(stateCode, countryCode) : undefined
    const cityData = opt && countryCode && stateCode
      ? City.getCitiesOfState(countryCode, stateCode).find((c) => c.name === opt.value)
      : undefined
    const location = buildLocationString(opt?.label, state?.name, country?.name)
    onChange(location, {
      city: opt?.label,
      state: state?.name,
      country: country?.name,
      lat: cityData?.latitude ? parseFloat(cityData.latitude) : undefined,
      lng: cityData?.longitude ? parseFloat(cityData.longitude) : undefined,
    })
  }

  const selectStyles = {
    control: (base: object) => ({
      ...base,
      borderColor: "#d1d5db",
      borderRadius: "0.5rem",
      padding: "0.125rem 0.25rem",
      boxShadow: "none",
      "&:hover": { borderColor: "#6b7280" },
    }),
    option: (base: object, state: { isSelected: boolean; isFocused: boolean }) => ({
      ...base,
      backgroundColor: state.isSelected ? "#18181b" : state.isFocused ? "#f4f4f5" : "white",
      color: state.isSelected ? "white" : "#111827",
    }),
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {value && !countryCode && (
        <p className="text-sm text-zinc-600">
          Current: <span className="font-medium text-zinc-900">{value}</span>
        </p>
      )}
      <Select
        instanceId="country-select"
        options={countryOptions}
        onChange={handleCountryChange}
        placeholder={placeholder ?? "Select country"}
        isDisabled={disabled}
        isClearable
        styles={selectStyles}
        classNamePrefix="location"
      />
      {countryCode && stateOptions.length > 0 && (
        <Select
          instanceId="state-select"
          options={stateOptions}
          onChange={handleStateChange}
          placeholder="Select state / region"
          isDisabled={disabled}
          isClearable
          styles={selectStyles}
          classNamePrefix="location"
        />
      )}
      {countryCode && stateCode && cityOptions.length > 0 && (
        <Select
          instanceId="city-select"
          options={cityOptions}
          onChange={handleCityChange}
          placeholder="Select city"
          isDisabled={disabled}
          isClearable
          styles={selectStyles}
          classNamePrefix="location"
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
