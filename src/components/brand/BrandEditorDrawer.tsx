import { Button, Drawer, Input, Select, Space, Typography } from 'antd';
import type { BrandProfile } from '../../domain/types';

interface BrandEditorDrawerProps {
  open: boolean;
  brand: BrandProfile;
  onChange: (brand: BrandProfile) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}

export function BrandEditorDrawer({
  open,
  brand,
  onChange,
  onClose,
  onSave,
  saving,
}: BrandEditorDrawerProps) {
  return (
    <Drawer
      title="编辑品牌资料"
      width={460}
      open={open}
      onClose={onClose}
      destroyOnClose={false}
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={saving} onClick={onSave} data-testid="brand-drawer-save">
            保存资料
          </Button>
        </Space>
      }
    >
      <div className="brand-editor-form">
        <label className="brand-editor-field">
          <Typography.Text strong>商家名称</Typography.Text>
          <Input
            value={brand.merchant}
            onChange={(event) => onChange({ ...brand, merchant: event.target.value })}
            data-testid="brand-merchant-input"
          />
        </label>
        <label className="brand-editor-field">
          <Typography.Text strong>品牌语气</Typography.Text>
          <Select
            mode="tags"
            value={brand.tone}
            onChange={(tone) => onChange({ ...brand, tone })}
            options={brand.tone.map((item) => ({ value: item, label: item }))}
            placeholder="输入语气标签"
          />
          <Typography.Text type="secondary">脚本生成时用于控制表达方式与节奏。</Typography.Text>
        </label>
        <label className="brand-editor-field">
          <Typography.Text strong>禁用词</Typography.Text>
          <Select
            mode="tags"
            value={brand.prohibitedWords}
            onChange={(prohibitedWords) => onChange({ ...brand, prohibitedWords })}
            options={brand.prohibitedWords.map((item) => ({ value: item, label: item }))}
            placeholder="输入禁用词并回车"
          />
          <Typography.Text type="secondary">脚本命中后会提升风险级别。</Typography.Text>
        </label>
        <label className="brand-editor-field">
          <Typography.Text strong>人物 IP 口吻</Typography.Text>
          <Input
            value={brand.personProfile.tone}
            onChange={(event) =>
              onChange({
                ...brand,
                personProfile: { ...brand.personProfile, tone: event.target.value },
              })
            }
          />
        </label>
        <label className="brand-editor-field">
          <Typography.Text strong>人物 IP 备注</Typography.Text>
          <Input.TextArea
            rows={4}
            value={brand.personProfile.notes}
            onChange={(event) =>
              onChange({
                ...brand,
                personProfile: { ...brand.personProfile, notes: event.target.value },
              })
            }
          />
        </label>
      </div>
    </Drawer>
  );
}
