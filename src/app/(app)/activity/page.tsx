"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";

type Activity = {
  id: string;
  action: string;
  targetType: string;
  createdAt: string;
  user: { name: string };
  previousValue?: unknown;
  newValue?: unknown;
};

export default function ActivityPage() {
  const [items, setItems] = useState<Activity[]>([]);

  useEffect(() => {
    api<{ items: Activity[] }>("/api/activity").then((data) => setItems(data.items));
  }, []);

  return (
    <div>
      <PageHeader title="Activity log" description="Who created, assigned, started, completed or edited what." />
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{item.action}</p>
                <p className="text-sm text-[#5d6f6b]">
                  {item.user.name} · {item.targetType}
                </p>
              </div>
              <p className="text-sm text-[#5d6f6b]">{formatDateTime(item.createdAt)}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
