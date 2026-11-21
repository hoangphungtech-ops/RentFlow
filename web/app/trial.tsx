'use client'
import { Action, api, field } from './shared'
export function Trial() {
  return <Action title="Đăng ký dùng thử" button="Gửi đăng ký" fields={[
    field('fullName','Họ tên'), field('contact','Email hoặc số điện thoại'),
    field('roomCount','Số phòng','number',true), field('note','Nhu cầu của bạn','text',true),
  ]} submit={data => api('trials', '', data)} />
}
