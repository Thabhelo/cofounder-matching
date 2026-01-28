"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { api } from "@/lib/api"
import type { Organization, OrgType } from "@/lib/types"

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<OrgType | "">("")
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  useEffect(() => {
    async function loadOrganizations() {
      setLoading(true)
      try {
        const data = await api.organizations.list({
          org_type: selectedType || undefined,
          verified_only: verifiedOnly,
        })
        setOrganizations(data)
      } catch (error) {
        console.error("Failed to load organizations:", error)
      } finally {
        setLoading(false)
      }
    }

    loadOrganizations()
  }, [selectedType, verifiedOnly])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-2xl font-bold text-blue-600">
            CoFounder Match
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Organizations</h1>
          <p className="text-gray-600">
            Discover accelerators, universities, nonprofits, and more supporting entrepreneurship
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value as OrgType | "")}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value="accelerator">Accelerator</option>
            <option value="university">University</option>
            <option value="nonprofit">Nonprofit</option>
            <option value="coworking">Coworking Space</option>
            <option value="government">Government</option>
            <option value="other">Other</option>
          </select>

          <label className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={e => setVerifiedOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Verified only</span>
          </label>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : organizations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-600">No organizations found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map(org => (
              <Link
                key={org.id}
                href={`/organizations/${org.slug}`}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    {org.logo_url && (
                      <Image
                        src={org.logo_url}
                        alt={org.name}
                        width={64}
                        height={64}
                        className="w-16 h-16 object-contain mb-3"
                        unoptimized
                      />
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{org.name}</h3>
                  </div>
                  {org.is_verified && (
                    <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {org.org_type && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                      {org.org_type}
                    </span>
                  )}
                  {org.location && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {org.location}
                    </span>
                  )}
                </div>

                {org.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-3">{org.description}</p>
                )}

                {org.focus_areas && org.focus_areas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {org.focus_areas.slice(0, 3).map((area, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {area}
                      </span>
                    ))}
                    {org.focus_areas.length > 3 && (
                      <span className="px-2 py-1 text-gray-600 text-xs">
                        +{org.focus_areas.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
