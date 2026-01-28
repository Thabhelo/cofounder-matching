"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/api"
import type { Resource } from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"

export default function ResourceDetailPage() {
  const params = useParams()
  const [resource, setResource] = useState<Resource | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadResource() {
      try {
        const data = await api.resources.getById(params.id as string)
        setResource(data)
      } catch (error) {
        console.error("Failed to load resource:", error)
      } finally {
        setLoading(false)
      }
    }

    loadResource()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
      </div>
    )
  }

  if (!resource) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Resource not found</h2>
          <Link href="/resources" className="text-zinc-900 hover:underline">
            Back to Resources
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
        <Link href="/resources" className="text-zinc-900 hover:underline mb-6 inline-block">
          ← Back to Resources
        </Link>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 bg-zinc-100 text-black text-sm font-medium rounded">
                {resource.category}
              </span>
              {resource.resource_type && (
                <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded">
                  {resource.resource_type}
                </span>
              )}
              {resource.is_featured && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded">
                  Featured
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">{resource.title}</h1>
            <p className="text-gray-700 text-lg leading-relaxed">{resource.description}</p>
          </div>

          <div className="border-t pt-6 space-y-4">
            {resource.amount_min && resource.amount_max && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Funding Amount</h3>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(resource.amount_min)} - {formatCurrency(resource.amount_max)} {resource.currency}
                </p>
              </div>
            )}

            {resource.deadline && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Application Deadline</h3>
                <p className="text-gray-900">{formatDate(resource.deadline)}</p>
              </div>
            )}

            {resource.stage_eligibility && resource.stage_eligibility.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Stage Eligibility</h3>
                <div className="flex flex-wrap gap-2">
                  {resource.stage_eligibility.map((stage, idx) => (
                    <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded">
                      {stage}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {resource.location_eligibility && resource.location_eligibility.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Location Eligibility</h3>
                <div className="flex flex-wrap gap-2">
                  {resource.location_eligibility.map((location, idx) => (
                    <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded">
                      {location}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {resource.other_eligibility && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Additional Requirements</h3>
                <p className="text-gray-700">{resource.other_eligibility}</p>
              </div>
            )}

            {resource.tags && resource.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {resource.tags.map((tag, idx) => (
                    <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {resource.application_url && (
            <div className="border-t pt-6 mt-6">
              <a
                href={resource.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 bg-zinc-900 text-white font-medium rounded-lg hover:bg-black transition-colors"
              >
                Apply Now →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
