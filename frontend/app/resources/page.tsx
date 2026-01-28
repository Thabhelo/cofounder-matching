"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { api } from "@/lib/api"
import type { Resource, ResourceCategory } from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | "">("")
  const [selectedType, setSelectedType] = useState("")

  useEffect(() => {
    async function loadResources() {
      setLoading(true)
      try {
        const data = await api.resources.list({
          category: selectedCategory || undefined,
          resource_type: selectedType || undefined,
        })
        setResources(data)
      } catch (error) {
        console.error("Failed to load resources:", error)
      } finally {
        setLoading(false)
      }
    }

    loadResources()
  }, [selectedCategory, selectedType])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/dashboard" className="text-2xl font-bold text-zinc-900">
            CoFounder Match
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Resources</h1>
          <p className="text-gray-600">
            Discover funding opportunities, mentorship programs, and tools to help your startup succeed
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value as ResourceCategory | "")}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-zinc-900"
          >
            <option value="">All Categories</option>
            <option value="funding">Funding</option>
            <option value="mentorship">Mentorship</option>
            <option value="legal">Legal</option>
            <option value="accounting">Accounting</option>
            <option value="prototyping">Prototyping</option>
            <option value="program">Program</option>
            <option value="other">Other</option>
          </select>

          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-zinc-900"
          >
            <option value="">All Types</option>
            <option value="grant">Grant</option>
            <option value="loan">Loan</option>
            <option value="service">Service</option>
            <option value="program">Program</option>
            <option value="tool">Tool</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-600">No resources found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.map(resource => (
              <Link
                key={resource.id}
                href={`/resources/${resource.id}`}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="inline-block px-2 py-1 bg-zinc-100 text-black text-xs font-medium rounded">
                      {resource.category}
                    </span>
                    {resource.is_featured && (
                      <span className="ml-2 inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                        Featured
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">{resource.title}</h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">{resource.description}</p>

                {resource.amount_min && resource.amount_max && (
                  <div className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Amount:</span> {formatCurrency(resource.amount_min)} - {formatCurrency(resource.amount_max)}
                  </div>
                )}

                {resource.deadline && (
                  <div className="text-sm text-gray-700 mb-2">
                    <span className="font-medium">Deadline:</span> {formatDate(resource.deadline)}
                  </div>
                )}

                {resource.tags && resource.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {resource.tags.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {tag}
                      </span>
                    ))}
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
