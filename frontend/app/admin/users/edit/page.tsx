import UserForm from "@/components/admin/UserForm";

// 本来はAPIで取得します。ここではダミー。
const DUMMY = {
  id: "u1",
  name: "山田 太郎",
  furigana: "ヤマダ タロウ",
  email: "yamada@example.com",
  employeeCode: "A001",
  branchId: "tokyo",
  isAdmin: true,
  isAccounting: false,
  isActive: true,
};

export function generateStaticParams() {
  return [{ id: "u1" }, { id: "u2" }, { id: "u3" }];
}

export default function EditUserPage({ params }: { params: { id: string } }) {
  // params.id で取得する想定。今回は固定ダミー。
  const initial = { ...DUMMY, id: params.id };

  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        <UserForm mode="edit" initialValue={initial} />
      </div>
    </div>
  );
}
