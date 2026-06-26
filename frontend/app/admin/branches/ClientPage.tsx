"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BranchForm, { BranchFormValue } from "@/components/admin/BranchForm";
import BranchList, { BranchRow } from "@/components/admin/BranchList";
import EmployeeSearchModal, {
  EmployeeSearchResult,
} from "@/components/admin/EmployeeSearchModal";

const INITIAL_BRANCHES: BranchRow[] = [
  {
    id: "branch-1",
    branchCode: "B001",
    branchName: "東京支店",
    branchNameKana: "トウキョウシテン",
    postalCode: "100-0001",
    address: "東京都千代田区千代田1-1",
    phone: "03-1234-5678",
    managerEmployeeId: "0000000001",
    managerName: "山田 太郎",
    isActive: true,
    updatedAt: "2026-06-01",
  },
  {
    id: "branch-2",
    branchCode: "B002",
    branchName: "大阪支店",
    branchNameKana: "オオサカシテン",
    postalCode: "530-0001",
    address: "大阪府大阪市北区梅田1-1",
    phone: "06-1234-5678",
    managerEmployeeId: "0000000002",
    managerName: "佐藤 花子",
    isActive: true,
    updatedAt: "2026-06-02",
  },
  {
    id: "branch-3",
    branchCode: "B003",
    branchName: "名古屋支店",
    branchNameKana: "ナゴヤシテン",
    postalCode: "450-0002",
    address: "愛知県名古屋市中村区名駅1-1",
    phone: "052-123-4567",
    managerEmployeeId: "0000000003",
    managerName: "鈴木 一郎",
    isActive: false,
    updatedAt: "2026-06-03",
  },
];

const EMPTY_FORM: BranchFormValue = {
  branchCode: "",
  branchName: "",
  branchNameKana: "",
  postalCode: "",
  address: "",
  phone: "",
  managerEmployeeId: "",
  managerName: "",
  isActive: true,
};

export default function ClientPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<BranchRow[]>(INITIAL_BRANCHES);
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [formValue, setFormValue] = useState<BranchFormValue>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof BranchFormValue, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [editingBranchCode, setEditingBranchCode] = useState<string | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<BranchRow | null>(null);
  const [isEmployeeSearchOpen, setIsEmployeeSearchOpen] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
  useEffect(() => {
    fetch(`${API_BASE_URL}/auth/me`, {
      credentials: "include",
    }).then((res) => {
      if (!res.ok) {
        router.push("/");
      }
    });
  }, []);

  useEffect(() => {
    if (!API_BASE_URL) return;

    fetch(`${API_BASE_URL}/branches`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.branches) {
          setBranches(body.branches.map(toBranchRow));
        }
      });
  }, [API_BASE_URL]);

  const filteredBranches = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return branches.filter((branch) => {
      if (onlyActive && !branch.isActive) return false;
      if (!keyword) return true;

      return [
        branch.branchCode,
        branch.branchName,
        branch.branchNameKana,
        branch.postalCode,
        branch.address,
        branch.phone,
        branch.managerEmployeeId,
        branch.managerName,
        branch.isActive ? "有効" : "削除済",
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [branches, onlyActive, query]);

  const openCreate = () => {
    setFormMode("create");
    setFormValue({
      ...EMPTY_FORM,
      branchCode: getNextBranchCode(branches),
    });
    setEditingBranchCode(null);
    setFormErrors({});
  };

  const openEdit = (branch: BranchRow) => {
    setFormMode("edit");
    setEditingBranchCode(branch.branchCode);
    setFormValue({
      id: branch.id,
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      branchNameKana: branch.branchNameKana,
      postalCode: branch.postalCode,
      address: branch.address,
      phone: branch.phone,
      managerEmployeeId: branch.managerEmployeeId,
      managerName: branch.managerName,
      isActive: branch.isActive,
    });
    setFormErrors({});
  };

  const closeForm = () => {
    setFormMode(null);
    setFormValue(EMPTY_FORM);
    setFormErrors({});
    setSaving(false);
    setEditingBranchCode(null);
    setIsEmployeeSearchOpen(false);
  };

  const selectManager = (employee: EmployeeSearchResult) => {
    setFormValue((current) => ({
      ...current,
      managerEmployeeId: employee.employee_id,
      managerName: employee.name,
    }));
    setIsEmployeeSearchOpen(false);
  };

  const saveBranch = async () => {
    const errors = validateBranch(formValue, branches, formMode);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || !formMode) return;

    setSaving(true);
    const updatedAt = formatDate(new Date());

    try {
      if (formMode === "create") {
        let newBranch: BranchRow = {
          id: `branch-${Date.now()}`,
          branchCode: formValue.branchCode.trim(),
          branchName: formValue.branchName.trim(),
          branchNameKana: formValue.branchNameKana.trim(),
          postalCode: formValue.postalCode.trim(),
          address: formValue.address.trim(),
          phone: formValue.phone.trim(),
          managerEmployeeId: formValue.managerEmployeeId.trim(),
          managerName: formValue.managerName.trim(),
          isActive: formValue.isActive,
          updatedAt,
        };

        if (API_BASE_URL) {
          const body = await requestJson(`${API_BASE_URL}/branches`, {
            method: "POST",
            body: JSON.stringify(toBranchPayload(formValue)),
          });
          newBranch = toBranchRow(body.branch);
        }

        setBranches((current) => [newBranch, ...current]);
      } else {
        const targetBranchCode = editingBranchCode ?? formValue.branchCode;
        let updatedBranch: BranchRow | null = null;

        if (API_BASE_URL) {
          const body = await requestJson(
            `${API_BASE_URL}/branches/${encodeURIComponent(targetBranchCode)}`,
            {
              method: "PUT",
              body: JSON.stringify(toBranchPayload(formValue)),
            },
          );
          updatedBranch = toBranchRow(body.branch);
        }

        setBranches((current) =>
          current.map((branch) =>
            branch.branchCode === targetBranchCode || branch.id === formValue.id
              ? (updatedBranch ?? {
                  ...branch,
                  branchCode: formValue.branchCode.trim(),
                  branchName: formValue.branchName.trim(),
                  branchNameKana: formValue.branchNameKana.trim(),
                  postalCode: formValue.postalCode.trim(),
                  address: formValue.address.trim(),
                  phone: formValue.phone.trim(),
                  managerEmployeeId: formValue.managerEmployeeId.trim(),
                  managerName: formValue.managerName.trim(),
                  isActive: formValue.isActive,
                  updatedAt,
                })
              : branch,
          ),
        );
      }

      closeForm();
    } catch {
      setFormErrors({ branchName: "保存に失敗しました" });
      setSaving(false);
    }
  };

  const deleteBranch = async () => {
    if (!deleteTarget) return;

    try {
      if (API_BASE_URL) {
        await requestJson(
          `${API_BASE_URL}/branches/${encodeURIComponent(deleteTarget.branchCode)}`,
          { method: "DELETE" },
        );
      }

      setBranches((current) =>
        current.map((branch) =>
          branch.id === deleteTarget.id
            ? { ...branch, isActive: false, updatedAt: formatDate(new Date()) }
            : branch,
        ),
      );
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        <section className="dashboard-card dashboard-header-card">
          <div className="dashboard-head page-header">
            <div>
              <h1 className="page-title dashboard-title">支店管理</h1>
              <p className="dashboard-sub">
                支店の検索、登録、編集、論理削除を管理します。
              </p>
            </div>
            <button type="button" className="btn btn-dark" onClick={openCreate}>
              + 新規登録
            </button>
          </div>
        </section>

        <section className="dashboard-card">
          <div className="dashboard-controls">
            <input
              className="cell-input"
              placeholder="支店コード/支店名/住所/電話番号で検索"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(event) => setOnlyActive(event.target.checked)}
              />
              有効のみ
            </label>
          </div>

          <div className="dashboard-sub">
            表示件数: <strong>{filteredBranches.length}</strong>
          </div>
        </section>

        <BranchList
          branches={filteredBranches}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
        />
      </div>

      {formMode && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>{formMode === "create" ? "支店登録" : "支店編集"}</h2>
            <BranchForm
              mode={formMode}
              value={formValue}
              errors={formErrors}
              saving={saving}
              onChange={setFormValue}
              onOpenManagerSearch={() => setIsEmployeeSearchOpen(true)}
              onSubmit={saveBranch}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}

      <EmployeeSearchModal
        open={isEmployeeSearchOpen}
        apiBaseUrl={API_BASE_URL}
        onClose={() => setIsEmployeeSearchOpen(false)}
        onSelect={selectManager}
      />

      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>支店論理削除</h2>
            <p className="dashboard-sub">
              {deleteTarget.branchName}{" "}
              を削除済にします。データは一覧に残ります。
            </p>
            <div className="dashboard-controls">
              <button
                type="button"
                className="btn btn-dark"
                onClick={deleteBranch}
              >
                削除
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setDeleteTarget(null)}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function validateBranch(
  value: BranchFormValue,
  branches: BranchRow[],
  mode: "create" | "edit" | null,
) {
  const errors: Partial<Record<keyof BranchFormValue, string>> = {};
  const code = value.branchCode.trim();

  if (!code) {
    errors.branchCode = "支店コードは必須です";
  } else {
    const duplicated = branches.some(
      (branch) =>
        branch.branchCode.toLowerCase() === code.toLowerCase() &&
        (mode === "create" || branch.id !== value.id),
    );
    if (duplicated) {
      errors.branchCode = "同じ支店コードが既に登録されています";
    }
  }

  if (!value.branchName.trim()) {
    errors.branchName = "支店名は必須です";
  }

  if (value.phone.trim() && !/^[0-9-]+$/.test(value.phone.trim())) {
    errors.phone = "電話番号は数字とハイフンで入力してください";
  }

  return errors;
}

function getNextBranchCode(branches: BranchRow[]) {
  const maxNumber = branches.reduce((max, branch) => {
    const matched = branch.branchCode.match(/^B(\d+)$/i);
    if (!matched) return max;
    return Math.max(max, Number(matched[1]));
  }, 0);

  return `B${String(maxNumber + 1).padStart(3, "0")}`;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function requestJson(url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error ?? "API request failed");
  }
  return body;
}

function toBranchPayload(value: BranchFormValue) {
  return {
    branch_code: value.branchCode.trim(),
    branch_name: value.branchName.trim(),
    branch_name_kana: value.branchNameKana.trim(),
    postal_code: value.postalCode.trim(),
    address: value.address.trim(),
    phone: value.phone.trim(),
    manager_employee_id: value.managerEmployeeId.trim() || null,
    is_active: value.isActive,
  };
}

function toBranchRow(row: Record<string, any>): BranchRow {
  const branchCode = row.branch_code ?? row.branchCode ?? "";

  return {
    id: row.id ?? branchCode,
    branchCode,
    branchName: row.branch_name ?? row.branchName ?? "",
    branchNameKana: row.branch_name_kana ?? row.branchNameKana ?? "",
    postalCode: row.postal_code ?? row.postalCode ?? "",
    address: row.address ?? "",
    phone: row.phone ?? "",
    managerEmployeeId: row.manager_employee_id ?? row.managerEmployeeId ?? "",
    managerName: row.manager_name ?? row.managerName ?? "",
    isActive: row.is_active ?? row.isActive ?? !row.is_deleted,
    updatedAt: (row.updated_at ?? row.updatedAt ?? "").slice(0, 10),
  };
}
