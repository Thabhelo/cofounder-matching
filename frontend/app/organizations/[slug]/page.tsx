"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { api } from "@/lib/api"
import type { Organization } from "@/lib/types"

export default function OrganizationDetailPage() {
  const params = useParams()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadOrganization() {
      try {
        const data = await api.organizations.getByIdOrSlug(params.slug as string)
        setOrganization(data)
      } catch (error) {
        console.error("Failed to load organization:", error)
      } finally {
        setLoading(false)
      }
    }

    loadOrganization()
  }, [params.slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Organization not found</h2>
          <Link href="/organizations" className="text-zinc-900 hover:underline">
            Back to Organizations
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-2xl font-bold text-zinc-900">
            CoFounder Match
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/organizations" className="text-zinc-900 hover:underline mb-6 inline-block">
          ← Back to Organizations
        </Link>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex items-start gap-6 mb-6">
            {organization.logo_url && (
              <Image
                src={organization.logo_url}
                alt={organization.name}
                width={96}
                height={96}
                className="w-24 h-24 object-contain flex-shrink-0"
                unoptimized
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{organization.name}</h1>
                {organization.is_verified && (
                  <svg className="w-8 h-8 text-zinc-900 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              <div className="flex items-center gap-2 mb-3">
                {organization.org_type && (
                  <span className="px-3 py-1 bg-zinc-100 text-black text-sm font-medium rounded">
                    {organization.org_type}
                  </span>
                )}
                {organization.location && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                    {organization.location}
                  </span>
                )}
              </div>

              {organization.description && (
                <p className="text-gray-700 text-lg leading-relaxed">{organization.description}</p>
              )}
            </div>
          </div>

          <div className="border-t pt-6 space-y-6">
            {organization.focus_areas && organization.focus_areas.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Focus Areas</h3>
                <div className="flex flex-wrap gap-2">
                  {organization.focus_areas.map((area, idx) => (
                    <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {organization.website_url && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Website</h3>
                <a
                  href={organization.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-900 hover:underline"
                >
                  {organization.website_url}
                </a>
              </div>
            )}

            {(organization.contact_email || organization.contact_phone) && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Contact Information</h3>
                <div className="space-y-1">
                  {organization.contact_email && (
                    <p className="text-gray-900">
                      <span className="font-medium">Email:</span>{" "}
                      <a href={`mailto:${organization.contact_email}`} className="text-zinc-900 hover:underline">
                        {organization.contact_email}
                      </a>
                    </p>
                  )}
                  {organization.contact_phone && (
                    <p className="text-gray-900">
                      <span className="font-medium">Phone:</span> {organization.contact_phone}
                    </p>
                  )}
                </div>
              </div>
            )}

            {organization.is_verified && (
              <div className="bg-zinc-100 border border-zinc-300 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-zinc-900" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium text-zinc-900">Verified Organization</p>
                    <p className="text-sm text-zinc-700">
                      This organization has been verified by our team
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {organization.website_url && (
            <div className="border-t pt-6 mt-6">
              <a
                href={organization.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-black transition-colors"
              >
                Visit Website →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
