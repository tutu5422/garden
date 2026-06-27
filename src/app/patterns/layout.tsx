'use client'

import { ConfigProvider } from 'antd'
import type { ReactNode } from 'react'

/**
 * 织集（编织图解）模块布局
 *
 * 通过 Ant Design ConfigProvider 统一本模块下所有 antd 组件的配色，
 * 使其与主站 --skin-* 设计体系保持一致，避免 antd 默认蓝色主题污染。
 */
export default function PatternsLayout({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#E8315B',
          colorBgContainer: '#FFFFFF',
          colorBorder: '#E0D9CE',
          borderRadius: 8,
          fontFamily: "'Inter', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
          colorText: '#12100E',
          colorTextSecondary: '#7A7268',
          colorBgElevated: '#F6F3EF',
          colorFillAlter: '#F0EBE3',
        },
      }}
    >
      {children}
    </ConfigProvider>
  )
}
